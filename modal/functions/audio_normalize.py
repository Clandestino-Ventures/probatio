"""
SPECTRA — Forensic Audio Normalization
========================================
Modal function that normalizes audio to a forensic-grade canonical format:
44.1 kHz, 24-bit, mono, -14 LUFS (EBU R128).

This is the FIRST step of any forensic audio comparison. Without normalization,
a defense attorney can argue: "results are unreliable because you compared audio
at different loudness levels." The normalization ensures all comparisons are
loudness-independent, measuring MUSICAL CONTENT not volume.

Pre- and post-normalization metrics are recorded for the chain of custody.
"""

from __future__ import annotations

import hashlib
import io
import logging
import os
import time
from typing import Any

import modal

from ..config import (
    NORMALIZE_PEAK_CEILING_DB,
    NORMALIZE_STANDARD,
    NORMALIZE_TARGET_LUFS,
    NORMALIZE_TIMEOUT,
    TARGET_BIT_DEPTH,
    TARGET_CHANNELS,
    TARGET_SAMPLE_RATE,
    app,
    audio_normalize_image,
)
from ..utils import hash_bytes, upload_bytes_to_supabase

logger = logging.getLogger("spectra.normalize")


# ---------------------------------------------------------------------------
# Audio download + format detection
# ---------------------------------------------------------------------------

def _download_audio(url: str) -> bytes:
    """Download audio bytes from a URL."""
    import requests

    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    if len(resp.content) == 0:
        raise ValueError("Downloaded file is empty")
    return resp.content


def _detect_format(audio_bytes: bytes) -> str:
    """Detect audio format from file header bytes."""
    header = audio_bytes[:12]
    if header[:3] == b"ID3" or header[:2] == b"\xff\xfb":
        return "mp3"
    if header[:4] == b"RIFF":
        return "wav"
    if header[:4] == b"fLaC":
        return "flac"
    if header[:4] == b"OggS":
        return "ogg"
    if header[4:8] == b"ftyp":
        return "aac/m4a"
    return "unknown"


# ---------------------------------------------------------------------------
# Core normalization
# ---------------------------------------------------------------------------

def _normalize_forensic(
    audio_bytes: bytes,
    target_lufs: float = NORMALIZE_TARGET_LUFS,
    target_sr: int = TARGET_SAMPLE_RATE,
    target_channels: int = TARGET_CHANNELS,
    target_bit_depth: int = 24,
    peak_ceiling_db: float = NORMALIZE_PEAK_CEILING_DB,
) -> tuple[bytes, dict[str, Any], dict[str, Any]]:
    """
    Forensic-grade audio normalization:
    1. Decode any format → raw PCM
    2. Measure original loudness (EBU R128 integrated LUFS)
    3. Resample to target sample rate
    4. Convert to mono
    5. Apply loudness normalization to target LUFS
    6. Apply true peak limiting
    7. Encode as WAV (lossless, deterministic)

    Returns: (wav_bytes, pre_metrics, post_metrics)
    """
    import librosa
    import numpy as np
    import pyloudnorm as pyln
    import soundfile as sf

    detected_format = _detect_format(audio_bytes)

    # Load at ORIGINAL sample rate first (for measuring original properties)
    y_original, sr_original = librosa.load(
        io.BytesIO(audio_bytes), sr=None, mono=False
    )

    original_channels = 1 if y_original.ndim == 1 else y_original.shape[0]
    original_duration = float(len(y_original if y_original.ndim == 1 else y_original[0]) / sr_original)

    # Measure ORIGINAL loudness (before any processing)
    if y_original.ndim > 1:
        y_for_meter = np.mean(y_original, axis=0)
    else:
        y_for_meter = y_original

    meter = pyln.Meter(sr_original)
    original_lufs = float(meter.integrated_loudness(y_for_meter))
    original_peak = float(20 * np.log10(np.max(np.abs(y_for_meter)) + 1e-10))

    pre_metrics = {
        "sample_rate": int(sr_original),
        "channels": int(original_channels),
        "duration_sec": round(original_duration, 2),
        "format": detected_format,
        "integrated_lufs": round(original_lufs, 1) if not np.isinf(original_lufs) else None,
        "true_peak_dbtp": round(original_peak, 1),
    }

    # Load at TARGET sample rate, mono
    y_resampled, _ = librosa.load(
        io.BytesIO(audio_bytes),
        sr=target_sr,
        mono=(target_channels == 1),
    )

    # Measure current loudness at target SR
    meter_target = pyln.Meter(target_sr)
    current_lufs = float(meter_target.integrated_loudness(y_resampled))

    # Apply LUFS normalization
    if np.isinf(current_lufs) or np.isnan(current_lufs):
        # Silent or near-silent audio — cannot normalize by loudness
        y_normalized = y_resampled
        gain_applied = 0.0
        actual_lufs = current_lufs
        logger.warning("Audio is silent/near-silent — LUFS normalization skipped")
    else:
        y_normalized = pyln.normalize.loudness(
            y_resampled, current_lufs, target_lufs
        )
        gain_applied = target_lufs - current_lufs

        # True peak limiting
        true_peak_linear = float(np.max(np.abs(y_normalized)))
        ceiling_linear = 10 ** (peak_ceiling_db / 20)

        if true_peak_linear > ceiling_linear:
            y_normalized = y_normalized * (ceiling_linear / true_peak_linear)
            logger.info(
                "Peak limiting applied: %.1f dBTP → %.1f dBTP",
                20 * np.log10(true_peak_linear + 1e-10),
                peak_ceiling_db,
            )

        actual_lufs = float(meter_target.integrated_loudness(y_normalized))

    actual_peak = float(20 * np.log10(np.max(np.abs(y_normalized)) + 1e-10))

    # Encode as WAV
    subtype = "PCM_24" if target_bit_depth == 24 else "PCM_16" if target_bit_depth == 16 else "FLOAT"
    out_buf = io.BytesIO()
    sf.write(out_buf, y_normalized, target_sr, subtype=subtype, format="WAV")
    wav_bytes = out_buf.getvalue()

    post_metrics = {
        "sample_rate": target_sr,
        "channels": target_channels,
        "bit_depth": target_bit_depth,
        "duration_sec": round(original_duration, 2),
        "format": "wav",
        "integrated_lufs": round(actual_lufs, 1) if not np.isinf(actual_lufs) else None,
        "true_peak_dbtp": round(actual_peak, 1),
        "gain_applied_db": round(gain_applied, 1),
    }

    return wav_bytes, pre_metrics, post_metrics


# ---------------------------------------------------------------------------
# Modal function (internal)
# ---------------------------------------------------------------------------

@app.function(
    image=audio_normalize_image,
    timeout=NORMALIZE_TIMEOUT,
    retries=1,
)
def audio_normalize(audio_url: str) -> dict[str, Any]:
    """Download and normalize audio. Returns wav bytes + metrics."""
    t0 = time.perf_counter()

    raw_bytes = _download_audio(audio_url)
    wav_bytes, pre, post = _normalize_forensic(raw_bytes)

    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info(
        "Normalization: %s → WAV | LUFS: %.1f → %.1f (gain: %.1f dB) in %.0f ms",
        pre.get("format", "?"),
        pre.get("integrated_lufs") or 0,
        post.get("integrated_lufs") or 0,
        post.get("gain_applied_db", 0),
        elapsed_ms,
    )

    return {
        "audio_bytes": wav_bytes,
        "pre_normalization": pre,
        "post_normalization": post,
        "processing_time_ms": round(elapsed_ms, 2),
    }


# ---------------------------------------------------------------------------
# HTTP Web Endpoint
# ---------------------------------------------------------------------------

@app.function(
    image=audio_normalize_image,
    timeout=NORMALIZE_TIMEOUT,
    retries=1,
)
@modal.web_endpoint(method="POST")
def normalize_endpoint(request: dict) -> dict:
    """
    HTTP POST endpoint for forensic audio normalization.

    Accepts JSON:
        audioUrl / file_url : str
        analysisId / analysis_id : str
        userId / user_id : str
        targetLufs : float (optional, default -14.0)
        targetSampleRate : int (optional, default 44100)
        targetChannels : int (optional, default 1)
        targetBitDepth : int (optional, default 24)
        peakCeilingDb : float (optional, default -1.0)
    """
    audio_url = request.get("audioUrl") or request.get("file_url", "")
    analysis_id = request.get("analysisId") or request.get("analysis_id", "default")
    user_id = request.get("userId") or request.get("user_id", "system")
    target_lufs = request.get("targetLufs", NORMALIZE_TARGET_LUFS)
    target_sr = request.get("targetSampleRate", TARGET_SAMPLE_RATE)
    target_ch = request.get("targetChannels", TARGET_CHANNELS)
    target_bd = request.get("targetBitDepth", 24)
    peak_ceil = request.get("peakCeilingDb", NORMALIZE_PEAK_CEILING_DB)

    t0 = time.perf_counter()

    raw_bytes = _download_audio(audio_url)
    input_hash = hashlib.sha256(raw_bytes).hexdigest()

    wav_bytes, pre, post = _normalize_forensic(
        raw_bytes,
        target_lufs=target_lufs,
        target_sr=target_sr,
        target_channels=target_ch,
        target_bit_depth=target_bd,
        peak_ceiling_db=peak_ceil,
    )

    normalized_hash = hash_bytes(wav_bytes)

    # Upload to Supabase Storage
    remote_path = f"{user_id}/{analysis_id}/normalized/normalized.wav"
    normalized_url = upload_bytes_to_supabase(
        data=wav_bytes,
        remote_path=remote_path,
        bucket="spectra-audio",
        content_type="audio/wav",
    )

    elapsed_ms = (time.perf_counter() - t0) * 1000

    return {
        "normalizedUrl": normalized_url,
        "normalizedHash": normalized_hash,
        "preNormalization": pre,
        "postNormalization": post,
        "normalizationParams": {
            "targetLufs": target_lufs,
            "targetSampleRate": target_sr,
            "targetChannels": target_ch,
            "targetBitDepth": target_bd,
            "peakCeilingDb": peak_ceil,
            "standard": NORMALIZE_STANDARD,
            "library": "pyloudnorm 0.1.1",
        },
        "inputHash": input_hash,
        "processingTimeMs": round(elapsed_ms, 2),
    }
