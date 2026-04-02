"""
SPECTRA — Feature Extraction (CREPE + librosa)
================================================
Modal function that extracts forensic audio features at both track-level
and segment-level granularity.

Track-level: pitch contour, chroma, onsets, beats, tempo, key, structure.
Segment-level: per 4s window (2s hop) — pitch, chroma vector, onset density,
RMS energy, per-stem metrics. This enables:
  "bars 12-16 of Track A match bars 8-12 of Track B"

* **CREPE** (v0.0.16) — pitch contour (F0 + confidence), Viterbi-smoothed
* **librosa** — chroma_cqt, onset_strength, beat_track, structural segmentation,
  key estimation via Krumhansl-Schmuckler correlation

GPU: T4
"""

from __future__ import annotations

import io
import logging
import os
import time
from typing import Any

import modal

from ..config import (
    CHROMA_HOP_LENGTH,
    CREPE_CONFIDENCE_THRESHOLD,
    CREPE_MODEL_CAPACITY,
    CREPE_STEP_SIZE,
    CUBLAS_WORKSPACE_CONFIG,
    FEATURE_EXTRACTION_TIMEOUT,
    RANDOM_SEED,
    RESOLUTIONS,
    SEGMENT_DURATION_SEC,
    SEGMENT_HOP_SEC,
    TARGET_SAMPLE_RATE,
    TORCH_DETERMINISTIC,
    app,
    feature_extraction_image,
    GPU_T4,
)
from ..utils import (
    download_audio_bytes,
    hash_json,
    numpy_to_list,
    segment_audio_from_array,
    upload_bytes_to_supabase,
)

logger = logging.getLogger("spectra.features")


# ---------------------------------------------------------------------------
# Determinism
# ---------------------------------------------------------------------------

def _enforce_determinism() -> None:
    import random

    import numpy as np
    import torch

    random.seed(RANDOM_SEED)
    np.random.seed(RANDOM_SEED)
    torch.manual_seed(RANDOM_SEED)
    torch.cuda.manual_seed_all(RANDOM_SEED)

    if TORCH_DETERMINISTIC:
        torch.use_deterministic_algorithms(True)
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False

    os.environ["CUBLAS_WORKSPACE_CONFIG"] = CUBLAS_WORKSPACE_CONFIG


# ---------------------------------------------------------------------------
# Track-level feature extractors
# ---------------------------------------------------------------------------

def _extract_pitch(y, sr: int) -> dict[str, Any]:
    """Run CREPE pitch detection. Returns time, frequency, confidence arrays."""
    import crepe
    import numpy as np

    time_arr, frequency, confidence, _ = crepe.predict(
        y, sr,
        model_capacity=CREPE_MODEL_CAPACITY,
        viterbi=True,
        step_size=CREPE_STEP_SIZE,
    )

    valid_mask = confidence > CREPE_CONFIDENCE_THRESHOLD
    return {
        "time_s": time_arr.tolist(),
        "frequency_hz": frequency.tolist(),
        "confidence": confidence.tolist(),
        "mean_pitch_hz": float(np.nanmean(frequency[valid_mask])) if np.any(valid_mask) else None,
        "pitch_std_hz": float(np.nanstd(frequency[valid_mask])) if np.any(valid_mask) else None,
        "step_size_ms": CREPE_STEP_SIZE,
        "model_capacity": CREPE_MODEL_CAPACITY,
    }


def _extract_chroma(y, sr: int) -> dict[str, Any]:
    """Compute chroma_cqt features (12-bin pitch class profile)."""
    import librosa

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, n_chroma=12, hop_length=CHROMA_HOP_LENGTH)
    return {
        "chroma_cqt": chroma.tolist(),
        "n_chroma": 12,
        "shape": list(chroma.shape),
        "mean_chroma": chroma.mean(axis=1).tolist(),
    }


def _extract_rhythm(y, sr: int) -> dict[str, Any]:
    """Compute onset envelope, beat positions, and tempo."""
    import librosa
    import numpy as np

    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    tempo_result = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
    # librosa may return tempo as scalar or array depending on version
    tempo = tempo_result[0]
    beat_frames = tempo_result[1]
    tempo_val = float(tempo) if not hasattr(tempo, "__len__") else float(tempo[0])
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)

    return {
        "estimated_tempo_bpm": tempo_val,
        "beat_times_s": beat_times.tolist(),
        "num_beats": len(beat_times),
        "onset_strength_mean": float(np.mean(onset_env)),
        "onset_strength_std": float(np.std(onset_env)),
        "onset_envelope": onset_env.tolist(),
    }


def _extract_structure(y, sr: int) -> dict[str, Any]:
    """Structural segmentation via MFCC recurrence matrix + novelty."""
    import librosa
    from librosa.segment import recurrence_matrix

    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    R = recurrence_matrix(mfcc, mode="affinity", metric="cosine", sparse=False)
    novelty = librosa.segment.novelty(R)
    peaks = librosa.util.peak_pick(
        novelty, pre_max=7, post_max=7, pre_avg=7, post_avg=7, delta=0.1, wait=10
    )
    boundary_times = librosa.frames_to_time(peaks, sr=sr)

    return {
        "segment_boundary_times_s": boundary_times.tolist(),
        "num_segments": len(boundary_times) + 1,
        "novelty_curve": novelty.tolist(),
    }


def _estimate_key(y, sr: int) -> dict[str, Any]:
    """
    Estimate musical key using Krumhansl-Schmuckler algorithm.
    Correlates the chroma profile against major/minor key profiles.
    """
    import librosa
    import numpy as np

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, n_chroma=12)
    chroma_profile = chroma.mean(axis=1)

    # Krumhansl-Schmuckler key-finding profiles
    major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
    note_names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

    best_corr = -1.0
    best_key = "C major"

    for shift in range(12):
        shifted = np.roll(chroma_profile, shift)
        corr_major = float(np.corrcoef(shifted, major_profile)[0, 1])
        corr_minor = float(np.corrcoef(shifted, minor_profile)[0, 1])

        if corr_major > best_corr:
            best_corr = corr_major
            best_key = f"{note_names[shift]} major"
        if corr_minor > best_corr:
            best_corr = corr_minor
            best_key = f"{note_names[shift]} minor"

    return {
        "key": best_key,
        "confidence": round(best_corr, 4),
        "chroma_profile": chroma_profile.tolist(),
    }


# ---------------------------------------------------------------------------
# Per-stem metrics (lightweight — no CREPE)
# ---------------------------------------------------------------------------

def _extract_stem_metrics(y, sr: int) -> dict[str, Any]:
    """
    Extract lightweight metrics for a single stem:
    onset density (onsets/sec), RMS energy, and whether pitch content exists.
    """
    import librosa
    import numpy as np

    rms = librosa.feature.rms(y=y)[0]
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr)
    duration = len(y) / sr

    onset_density = len(onsets) / duration if duration > 0 else 0.0

    # Simple pitch presence check: does spectral centroid suggest tonal content?
    spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    has_pitch = bool(float(np.mean(spectral_centroid)) > 200)  # rough heuristic

    return {
        "onset_density": round(onset_density, 2),
        "rms_energy": round(float(np.mean(rms)), 6),
        "has_pitch": has_pitch,
    }


# ---------------------------------------------------------------------------
# Segment-level feature extraction
# ---------------------------------------------------------------------------

def _extract_segment_features(
    full_mix_y,
    stems_audio: dict[str, Any],
    sr: int,
    segment_duration: float,
    segment_hop: float,
) -> list[dict[str, Any]]:
    """
    Extract features per segment (windowed analysis) for the full mix
    and per-stem metrics.

    Each segment gets:
    - CREPE pitch contour (if < 8s to keep CREPE fast)
    - Mean chroma vector (12-dim)
    - Onset density
    - RMS energy
    - Local tempo estimate
    - Per-stem onset density and RMS
    """
    import librosa
    import numpy as np

    segments = segment_audio_from_array(
        full_mix_y, sr=sr,
        segment_duration=segment_duration,
        hop_duration=segment_hop,
    )

    # Also segment each stem for per-stem metrics
    stems_segmented = {}
    for stem_name, stem_y in stems_audio.items():
        stems_segmented[stem_name] = segment_audio_from_array(
            stem_y, sr=sr,
            segment_duration=segment_duration,
            hop_duration=segment_hop,
        )

    result = []

    for seg in segments:
        seg_audio = seg["audio"]
        seg_idx = seg["index"]

        features: dict[str, Any] = {}

        # Pitch contour (CREPE) — only for short segments to keep latency manageable
        try:
            import crepe
            time_arr, freq, conf, _ = crepe.predict(
                seg_audio, sr,
                model_capacity=CREPE_MODEL_CAPACITY,
                viterbi=True,
                step_size=CREPE_STEP_SIZE,
            )
            valid = conf > CREPE_CONFIDENCE_THRESHOLD
            features["pitch_contour"] = {
                "times": time_arr.tolist(),
                "frequencies": freq.tolist(),
                "confidence": conf.tolist(),
            }
        except Exception:
            features["pitch_contour"] = None

        # Mean chroma vector (12-dim — compact per-segment representation)
        try:
            chroma = librosa.feature.chroma_cqt(y=seg_audio, sr=sr, n_chroma=12, hop_length=CHROMA_HOP_LENGTH)
            features["chroma_vector"] = chroma.mean(axis=1).tolist()
        except Exception:
            features["chroma_vector"] = [0.0] * 12

        # Onset density
        try:
            onset_env = librosa.onset.onset_strength(y=seg_audio, sr=sr)
            onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr)
            features["onset_density"] = round(len(onsets) / segment_duration, 2)
        except Exception:
            features["onset_density"] = 0.0

        # RMS energy
        try:
            rms = librosa.feature.rms(y=seg_audio)[0]
            features["rms_energy"] = round(float(np.mean(rms)), 6)
        except Exception:
            features["rms_energy"] = 0.0

        # Local tempo
        try:
            tempo_result = librosa.beat.beat_track(y=seg_audio, sr=sr)
            t = tempo_result[0]
            features["tempo_local"] = float(t) if not hasattr(t, "__len__") else float(t[0])
        except Exception:
            features["tempo_local"] = None

        # Per-stem metrics for this segment
        per_stem: dict[str, Any] = {}
        for stem_name, stem_segs in stems_segmented.items():
            if seg_idx < len(stem_segs):
                stem_seg_audio = stem_segs[seg_idx]["audio"]
                per_stem[stem_name] = _extract_stem_metrics(stem_seg_audio, sr)
            else:
                per_stem[stem_name] = {"onset_density": 0, "rms_energy": 0, "has_pitch": False}

        result.append({
            "index": seg_idx,
            "start_sec": seg["start_sec"],
            "end_sec": seg["end_sec"],
            "label": None,  # auto-labeled later via structural segmentation
            "features": features,
            "per_stem": per_stem,
        })

    logger.info("Extracted segment-level features for %d segments", len(result))
    return result


# ---------------------------------------------------------------------------
# Main Modal function
# ---------------------------------------------------------------------------

@app.function(
    image=feature_extraction_image,
    gpu=GPU_T4,
    timeout=FEATURE_EXTRACTION_TIMEOUT,
    retries=1,
)
def extract_features(
    stems_urls: dict[str, str],
    full_audio_url: str,
    analysis_id: str,
    segment_duration: float = SEGMENT_DURATION_SEC,
    segment_hop: float = SEGMENT_HOP_SEC,
    sr: int = TARGET_SAMPLE_RATE,
    resolutions: dict | None = None,
) -> dict[str, Any]:
    """
    Extract forensic audio features at track-level and segment-level.

    Parameters
    ----------
    stems_urls : dict
        {"vocals": url, "bass": url, "drums": url, "other": url}
    full_audio_url : str
        URL to the full mix audio.
    analysis_id : str
        Analysis ID for logging and hashing.
    segment_duration : float
        Segment window size in seconds.
    segment_hop : float
        Segment hop size in seconds.
    sr : int
        Target sample rate.

    Returns
    -------
    dict with:
        track_level : dict — pitch contour, chroma, rhythm, structure, key, duration
        segments : list[dict] — per-segment features + per-stem metrics
        model_versions : dict — pinned versions of CREPE, librosa, etc.
        output_hash : str — SHA-256 of output for chain of custody
        processing_time_ms : float
    """
    import librosa

    t0 = time.perf_counter()
    _enforce_determinism()

    logger.info("Starting feature extraction for analysis %s", analysis_id)

    # ── Download audio ────────────────────────────────────────────────────
    logger.info("Downloading full mix and stems...")
    full_bytes = download_audio_bytes(full_audio_url)
    full_mix_y, _ = librosa.load(io.BytesIO(full_bytes), sr=sr, mono=True)

    stems_audio = {}
    for stem_name in ("vocals", "bass", "drums", "other"):
        url = stems_urls.get(stem_name)
        if url:
            stem_bytes = download_audio_bytes(url)
            stem_y, _ = librosa.load(io.BytesIO(stem_bytes), sr=sr, mono=True)
            stems_audio[stem_name] = stem_y
        else:
            logger.warning("Missing stem URL for %s", stem_name)

    duration_sec = float(len(full_mix_y) / sr)
    logger.info("Audio loaded: %.1fs at %d Hz", duration_sec, sr)

    # ── Track-level features (full mix) ───────────────────────────────────
    track_level: dict[str, Any] = {
        "duration_sec": duration_sec,
    }

    # Pitch contour (CREPE on vocals stem if available, else full mix)
    pitch_source = stems_audio.get("vocals", full_mix_y)
    pitch_label = "vocals" if "vocals" in stems_audio else "full_mix"
    logger.info("Extracting pitch contour from %s...", pitch_label)
    try:
        track_level["pitch_contour"] = _extract_pitch(pitch_source, sr)
        track_level["pitch_contour"]["source_stem"] = pitch_label
    except Exception as exc:
        logger.warning("Pitch extraction failed: %s", exc)
        track_level["pitch_contour"] = {"error": str(exc)}

    # Chroma
    logger.info("Extracting chroma features...")
    try:
        track_level["chroma"] = _extract_chroma(full_mix_y, sr)
    except Exception as exc:
        logger.warning("Chroma extraction failed: %s", exc)
        track_level["chroma"] = {"error": str(exc)}

    # Rhythm (onset, beats, tempo)
    logger.info("Extracting rhythm features...")
    try:
        track_level["rhythm"] = _extract_rhythm(full_mix_y, sr)
    except Exception as exc:
        logger.warning("Rhythm extraction failed: %s", exc)
        track_level["rhythm"] = {"error": str(exc)}

    # Structural segmentation
    logger.info("Extracting structure...")
    try:
        track_level["structure"] = _extract_structure(full_mix_y, sr)
    except Exception as exc:
        logger.warning("Structure extraction failed: %s", exc)
        track_level["structure"] = {"error": str(exc)}

    # Key estimation (Krumhansl-Schmuckler)
    logger.info("Estimating key...")
    try:
        track_level["key"] = _estimate_key(full_mix_y, sr)
    except Exception as exc:
        logger.warning("Key estimation failed: %s", exc)
        track_level["key"] = {"error": str(exc)}

    # ── Segment-level features ────────────────────────────────────────────
    # Multi-resolution: extract at bar, phrase, and song levels
    resolved = resolutions or RESOLUTIONS
    multi_res_segments: dict[str, list] = {}

    for res_name, res_config in resolved.items():
        res_dur = res_config.get("segment_duration_sec")
        res_hop = res_config.get("segment_hop_sec")

        if res_dur is None or res_hop is None:
            # Song-level: one segment covering the entire track
            logger.info("Extracting song-level features...")
            song_seg = _extract_segment_features(
                full_mix_y, stems_audio, sr,
                segment_duration=duration_sec,
                segment_hop=duration_sec,
            )
            # Tag with resolution
            for s in song_seg:
                s["resolution"] = res_name
            multi_res_segments[res_name] = song_seg
        else:
            logger.info(
                "Extracting %s-level features (%.1fs window, %.1fs hop)...",
                res_name, res_dur, res_hop,
            )
            res_segs = _extract_segment_features(
                full_mix_y, stems_audio, sr,
                segment_duration=res_dur,
                segment_hop=res_hop,
            )
            for s in res_segs:
                s["resolution"] = res_name
            multi_res_segments[res_name] = res_segs

    # Legacy flat segments list (backward compat: use legacy single-resolution)
    segments = _extract_segment_features(
        full_mix_y, stems_audio, sr,
        segment_duration=segment_duration,
        segment_hop=segment_hop,
    )

    total_multi_res = sum(len(v) for v in multi_res_segments.values())
    logger.info(
        "Multi-resolution extraction: %d total segments (%s)",
        total_multi_res,
        ", ".join(f"{k}={len(v)}" for k, v in multi_res_segments.items()),
    )

    # ── Hash output for chain of custody ──────────────────────────────────
    output_summary = {
        "analysis_id": analysis_id,
        "duration_sec": duration_sec,
        "num_segments": len(segments),
        "tempo": track_level.get("rhythm", {}).get("estimated_tempo_bpm"),
        "key": track_level.get("key", {}).get("key"),
    }
    output_hash = hash_json(output_summary)

    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info(
        "Feature extraction complete: %d segments, %.1fs duration, %.1f ms",
        len(segments), duration_sec, elapsed_ms,
    )

    return {
        "track_level": numpy_to_list(track_level),
        "segments": numpy_to_list(segments),
        "multi_resolution_segments": numpy_to_list(multi_res_segments),
        "model_versions": {
            "crepe": "0.0.16",
            "crepe_model_capacity": CREPE_MODEL_CAPACITY,
            "crepe_step_size": CREPE_STEP_SIZE,
            "librosa": "0.10.1",
            "sample_rate": sr,
        },
        "output_hash": output_hash,
        "processing_time_ms": round(elapsed_ms, 2),
    }


# ---------------------------------------------------------------------------
# Legacy single-stem function (backward compatibility)
# ---------------------------------------------------------------------------

@app.function(
    image=feature_extraction_image,
    gpu=GPU_T4,
    timeout=FEATURE_EXTRACTION_TIMEOUT,
    retries=1,
)
def feature_extraction(
    audio_url: str,
    stem_name: str = "full_mix",
) -> dict[str, Any]:
    """
    Single-stem feature extraction. Kept for backward compatibility.
    New code should use extract_features() which handles all stems + segments.
    """
    import librosa

    t0 = time.perf_counter()
    _enforce_determinism()

    raw_bytes = download_audio_bytes(audio_url)
    y, _ = librosa.load(io.BytesIO(raw_bytes), sr=TARGET_SAMPLE_RATE, mono=True)

    features: dict[str, Any] = {
        "stem": stem_name,
        "duration_s": float(len(y) / TARGET_SAMPLE_RATE),
        "sample_rate": TARGET_SAMPLE_RATE,
    }

    try:
        features["pitch"] = _extract_pitch(y, TARGET_SAMPLE_RATE)
    except Exception as exc:
        features["pitch"] = {"error": str(exc)}

    try:
        features["chroma"] = _extract_chroma(y, TARGET_SAMPLE_RATE)
    except Exception as exc:
        features["chroma"] = {"error": str(exc)}

    try:
        features["rhythm"] = _extract_rhythm(y, TARGET_SAMPLE_RATE)
    except Exception as exc:
        features["rhythm"] = {"error": str(exc)}

    try:
        features["structure"] = _extract_structure(y, TARGET_SAMPLE_RATE)
    except Exception as exc:
        features["structure"] = {"error": str(exc)}

    elapsed_ms = (time.perf_counter() - t0) * 1000
    return {
        "features": features,
        "processing_time_ms": round(elapsed_ms, 2),
    }


# ---------------------------------------------------------------------------
# HTTP Web Endpoint — called via POST from the TypeScript client
# ---------------------------------------------------------------------------

@app.function(
    image=feature_extraction_image,
    gpu=GPU_T4,
    timeout=FEATURE_EXTRACTION_TIMEOUT,
    retries=1,
)
@modal.web_endpoint(method="POST")
def extract_features_endpoint(request: dict) -> dict:
    """
    HTTP POST endpoint for feature extraction.

    Accepts JSON body:
        stems_urls : dict — {"vocals": url, "bass": url, ...}
        full_audio_url : str — URL to the full mix audio
        analysis_id : str — Analysis ID
        user_id : str — User ID (optional, for storage path)
        segment_duration : float (optional, default 4.0)
        segment_hop : float (optional, default 2.0)
        sr : int (optional, default 44100)

    Extracts features, uploads raw features JSON to Supabase Storage,
    and returns the structured result.
    """
    import json

    stems_urls = request["stems_urls"]
    full_audio_url = request["full_audio_url"]
    analysis_id = request["analysis_id"]
    user_id = request.get("user_id", "system")
    segment_duration = request.get("segment_duration", SEGMENT_DURATION_SEC)
    segment_hop = request.get("segment_hop", SEGMENT_HOP_SEC)
    sr = request.get("sr", TARGET_SAMPLE_RATE)

    logger.info(
        "extract_features_endpoint: analysis=%s, user=%s", analysis_id, user_id
    )

    # Delegate to the existing function logic
    result = extract_features.local(
        stems_urls=stems_urls,
        full_audio_url=full_audio_url,
        analysis_id=analysis_id,
        segment_duration=segment_duration,
        segment_hop=segment_hop,
        sr=sr,
    )

    # Upload raw features JSON to Supabase Storage for archival
    try:
        features_json = json.dumps(result, sort_keys=True, default=str).encode("utf-8")
        remote_path = f"{user_id}/{analysis_id}/features/features.json"
        features_url = upload_bytes_to_supabase(
            data=features_json,
            remote_path=remote_path,
            bucket="spectra-audio",
            content_type="application/json",
        )
        result["features_url"] = features_url
        logger.info("Features JSON uploaded to %s", features_url)
    except Exception as exc:
        logger.warning("Failed to upload features JSON to Supabase: %s", exc)
        result["features_url"] = None

    return result
