"""
SPECTRA — CLAP Multi-Dimensional Embeddings
=============================================
Modal function that generates 512-dimensional audio embeddings using the
LAION CLAP model via HuggingFace Transformers.

This is what makes Spectra different from any generic similarity tool.
We generate FOUR track-level embeddings, one per forensic dimension:

  1. **timbre**  (full mix)   → "how does it sound overall?"
  2. **melody**  (vocals)     → "what is the melodic line?"
  3. **harmony** (bass+other) → "what is the harmonic progression?"
  4. **rhythm**  (drums)      → "what is the rhythmic pattern?"

Plus N segment-level embeddings (4s windows, 2s hop) of the full mix
for segment-to-segment similarity matching: "bars 12-16 of Track A
match bars 8-12 of Track B at 0.94 cosine similarity."

GPU: A10G
"""

from __future__ import annotations

import io
import logging
import os
import time
from typing import Any

import modal

from config import (
    CLAP_EMBEDDING_DIM,
    CLAP_MODEL,
    CLAP_SAMPLE_RATE,
    CLAP_TIMEOUT,
    CUBLAS_WORKSPACE_CONFIG,
    RANDOM_SEED,
    RESOLUTIONS,
    SEGMENT_DURATION_SEC,
    SEGMENT_HOP_SEC,
    TARGET_SAMPLE_RATE,
    TORCH_DETERMINISTIC,
    app,
    clap_image,
    GPU_A10G,
)
from utils import (
    download_audio_bytes,
    hash_json,
    numpy_to_list,
    segment_audio_from_array,
    upload_bytes_to_supabase,
)

logger = logging.getLogger("spectra.clap")

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
# Audio loading
# ---------------------------------------------------------------------------

def _load_audio_from_bytes(audio_bytes: bytes, sr: int = CLAP_SAMPLE_RATE) -> "numpy.ndarray":
    """Load audio bytes into a mono numpy array at the given sample rate."""
    import librosa

    y, _ = librosa.load(io.BytesIO(audio_bytes), sr=sr, mono=True)
    return y


def _mix_stems(stem_a: "numpy.ndarray", stem_b: "numpy.ndarray") -> "numpy.ndarray":
    """
    Mix two audio stems by averaging. Used to combine bass + other
    into a single "harmony" signal. Handles length mismatch by truncating
    to the shorter stem.
    """
    import numpy as np

    min_len = min(len(stem_a), len(stem_b))
    return (stem_a[:min_len] + stem_b[:min_len]) / 2.0


# ---------------------------------------------------------------------------
# CLAP embedding computation
# ---------------------------------------------------------------------------

_model_cache: dict[str, Any] = {}


def _get_model():
    """
    Load and cache the CLAP model + processor.
    Model is cached in module scope to avoid reloading on each call
    within the same container lifetime.
    """
    import torch
    from transformers import ClapModel, ClapProcessor

    if "model" not in _model_cache:
        logger.info("Loading CLAP model: %s", CLAP_MODEL)
        processor = ClapProcessor.from_pretrained(CLAP_MODEL)
        model = ClapModel.from_pretrained(CLAP_MODEL)
        model.eval()

        if torch.cuda.is_available():
            model = model.cuda()

        _model_cache["model"] = model
        _model_cache["processor"] = processor
        logger.info("CLAP model loaded successfully")

    return _model_cache["model"], _model_cache["processor"]


def _compute_embedding(audio_array: "numpy.ndarray") -> list[float]:
    """
    Compute a single 512-dimensional CLAP embedding from audio samples.

    Input must be mono at CLAP_SAMPLE_RATE (48kHz).
    Output is L2-normalized to unit length for cosine similarity.
    """
    import numpy as np
    import torch

    _enforce_determinism()

    model, processor = _get_model()

    inputs = processor(
        audios=[audio_array],
        sampling_rate=CLAP_SAMPLE_RATE,
        return_tensors="pt",
    )

    if torch.cuda.is_available():
        inputs = {k: v.cuda() if hasattr(v, "cuda") else v for k, v in inputs.items()}

    with torch.no_grad():
        audio_embed = model.get_audio_features(**inputs)

    embedding = audio_embed.squeeze().cpu().numpy()
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm

    return embedding.tolist()


# ---------------------------------------------------------------------------
# Main Modal function
# ---------------------------------------------------------------------------

@app.function(
    image=clap_image,
    gpu=GPU_A10G,
    timeout=CLAP_TIMEOUT,
)
def generate_embeddings(
    full_audio_url: str,
    stems_urls: dict[str, str],
    analysis_id: str,
    segment_duration: float = SEGMENT_DURATION_SEC,
    segment_hop: float = SEGMENT_HOP_SEC,
    resolutions: dict | None = None,
) -> dict[str, Any]:
    """
    Generate multi-dimensional CLAP embeddings for forensic similarity analysis.

    Produces:
    - 4 track-level embeddings (timbre, melody, harmony, rhythm)
    - N segment-level embeddings (full mix, windowed)

    Parameters
    ----------
    full_audio_url : str
        URL to the full mix audio file.
    stems_urls : dict
        {"vocals": url, "bass": url, "drums": url, "other": url}
    analysis_id : str
        Analysis ID for logging.
    segment_duration : float
        Segment window size in seconds (default 4.0).
    segment_hop : float
        Segment hop size in seconds (default 2.0).

    Returns
    -------
    dict with:
        track_level : dict of 4 dimensions, each with embedding + stem label
        segment_embeddings : list of {index, start_sec, end_sec, embedding}
        model : str
        model_version : str
        embedding_dim : int
        output_hash : str (SHA-256 of entire output for chain of custody)
        processing_time_ms : float
    """
    t0 = time.perf_counter()

    logger.info("Starting multi-dimensional CLAP embeddings for analysis %s", analysis_id)

    # ── Download all audio ────────────────────────────────────────────────
    logger.info("Downloading full mix and stems...")
    full_mix_bytes = download_audio_bytes(full_audio_url)
    stems_bytes = {}
    for stem_name in ("vocals", "bass", "drums", "other"):
        url = stems_urls.get(stem_name)
        if url:
            stems_bytes[stem_name] = download_audio_bytes(url)
        else:
            logger.warning("Missing stem URL for %s, skipping", stem_name)

    # ── Load audio at CLAP sample rate (48kHz) ────────────────────────────
    logger.info("Loading audio at %d Hz for CLAP...", CLAP_SAMPLE_RATE)
    full_mix_audio = _load_audio_from_bytes(full_mix_bytes, sr=CLAP_SAMPLE_RATE)

    stems_audio = {}
    for stem_name, raw_bytes in stems_bytes.items():
        stems_audio[stem_name] = _load_audio_from_bytes(raw_bytes, sr=CLAP_SAMPLE_RATE)

    # ── Track-level embeddings (4 dimensions) ─────────────────────────────
    logger.info("Computing track-level embeddings...")
    track_level = {}

    # 1. Timbre = full mix
    logger.info("  → timbre (full mix)")
    track_level["timbre"] = {
        "embedding": _compute_embedding(full_mix_audio),
        "stem": "full_mix",
    }

    # 2. Melody = vocals
    if "vocals" in stems_audio:
        logger.info("  → melody (vocals)")
        track_level["melody"] = {
            "embedding": _compute_embedding(stems_audio["vocals"]),
            "stem": "vocals",
        }

    # 3. Harmony = bass + other mixed
    if "bass" in stems_audio and "other" in stems_audio:
        logger.info("  → harmony (bass + other)")
        harmony_audio = _mix_stems(stems_audio["bass"], stems_audio["other"])
        track_level["harmony"] = {
            "embedding": _compute_embedding(harmony_audio),
            "stem": "bass_other",
        }

    # 4. Rhythm = drums
    if "drums" in stems_audio:
        logger.info("  → rhythm (drums)")
        track_level["rhythm"] = {
            "embedding": _compute_embedding(stems_audio["drums"]),
            "stem": "drums",
        }

    # ── Segment-level embeddings (full mix, windowed) ─────────────────────
    # Segment at the CLAP sample rate so embeddings are native resolution
    logger.info("Segmenting full mix for segment-level embeddings...")
    segments = segment_audio_from_array(
        full_mix_audio,
        sr=CLAP_SAMPLE_RATE,
        segment_duration=segment_duration,
        hop_duration=segment_hop,
    )

    segment_embeddings = []
    for seg in segments:
        if seg["index"] % 10 == 0:
            logger.info("  → segment %d / %d", seg["index"], len(segments))

        emb = _compute_embedding(seg["audio"])
        segment_embeddings.append({
            "index": seg["index"],
            "start_sec": seg["start_sec"],
            "end_sec": seg["end_sec"],
            "embedding": emb,
        })

    # ── Multi-resolution segment embeddings ────────────────────────────────
    resolved = resolutions or RESOLUTIONS
    multi_res_embeddings: dict[str, list] = {}

    for res_name, res_config in resolved.items():
        res_dur = res_config.get("segment_duration_sec")
        res_hop = res_config.get("segment_hop_sec")

        if res_dur is None or res_hop is None:
            # Song-level: one embedding for the full track
            logger.info("Computing song-level embedding...")
            emb = _compute_embedding(full_mix_audio)
            multi_res_embeddings[res_name] = [{
                "index": 0,
                "start_sec": 0.0,
                "end_sec": round(len(full_mix_audio) / CLAP_SAMPLE_RATE, 4),
                "resolution": res_name,
                "embedding": emb,
            }]
        else:
            logger.info(
                "Computing %s-level embeddings (%.1fs window, %.1fs hop)...",
                res_name, res_dur, res_hop,
            )
            res_segs = segment_audio_from_array(
                full_mix_audio, sr=CLAP_SAMPLE_RATE,
                segment_duration=res_dur, hop_duration=res_hop,
            )
            res_embs = []
            for seg in res_segs:
                emb = _compute_embedding(seg["audio"])
                res_embs.append({
                    "index": seg["index"],
                    "start_sec": seg["start_sec"],
                    "end_sec": seg["end_sec"],
                    "resolution": res_name,
                    "embedding": emb,
                })
            multi_res_embeddings[res_name] = res_embs

    total_mr = sum(len(v) for v in multi_res_embeddings.values())
    logger.info("Multi-resolution embeddings: %d total", total_mr)

    # ── Hash the complete output for chain of custody ─────────────────────
    output_for_hash = {
        "track_level": {
            dim: {"embedding": data["embedding"], "stem": data["stem"]}
            for dim, data in track_level.items()
        },
        "segment_count": len(segment_embeddings),
        "multi_res_count": total_mr,
        "model": CLAP_MODEL,
        "analysis_id": analysis_id,
    }
    output_hash = hash_json(output_for_hash)

    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info(
        "CLAP embeddings complete: %d track-level, %d legacy segments, %d multi-res in %.1f ms",
        len(track_level),
        len(segment_embeddings),
        total_mr,
        elapsed_ms,
    )

    return {
        "track_level": track_level,
        "segment_embeddings": segment_embeddings,
        "multi_resolution_embeddings": multi_res_embeddings,
        "model": CLAP_MODEL,
        "model_version": CLAP_MODEL,
        "embedding_dim": CLAP_EMBEDDING_DIM,
        "output_hash": output_hash,
        "processing_time_ms": round(elapsed_ms, 2),
    }


# ---------------------------------------------------------------------------
# Legacy single-embedding function (kept for backward compatibility)
# ---------------------------------------------------------------------------

@app.function(
    image=clap_image,
    gpu=GPU_A10G,
    timeout=CLAP_TIMEOUT,
)
def clap_embeddings(audio_url: str, label: str = "full_track") -> dict[str, Any]:
    """
    Compute a single CLAP embedding for one audio file.
    Kept for backward compatibility — new code should use generate_embeddings().
    """
    t0 = time.perf_counter()

    raw_bytes = download_audio_bytes(audio_url)
    audio_array = _load_audio_from_bytes(raw_bytes)
    embedding = _compute_embedding(audio_array)

    elapsed_ms = (time.perf_counter() - t0) * 1000

    return {
        "embedding": embedding,
        "label": label,
        "model": CLAP_MODEL,
        "embedding_dim": len(embedding),
        "processing_time_ms": round(elapsed_ms, 2),
    }


# ---------------------------------------------------------------------------
# HTTP Web Endpoint — called via POST from the TypeScript client
# ---------------------------------------------------------------------------

@app.function(
    image=clap_image,
    gpu=GPU_A10G,
    timeout=CLAP_TIMEOUT,
)
@modal.fastapi_endpoint(method="POST")
def generate_embeddings_endpoint(request: dict) -> dict:
    """
    HTTP POST endpoint for multi-dimensional CLAP embedding generation.

    Accepts JSON body:
        full_audio_url : str — URL to the full mix audio
        stems_urls : dict — {"vocals": url, "bass": url, ...}
        analysis_id : str — Analysis ID
        user_id : str — User ID (optional, for storage path)
        segment_duration : float (optional, default 4.0)
        segment_hop : float (optional, default 2.0)

    Generates embeddings, optionally uploads embeddings JSON to Supabase,
    and returns the structured result.
    """
    import json

    full_audio_url = request["full_audio_url"]
    stems_urls = request["stems_urls"]
    analysis_id = request["analysis_id"]
    user_id = request.get("user_id", "system")
    segment_duration = request.get("segment_duration", SEGMENT_DURATION_SEC)
    segment_hop = request.get("segment_hop", SEGMENT_HOP_SEC)

    logger.info(
        "generate_embeddings_endpoint: analysis=%s, user=%s",
        analysis_id,
        user_id,
    )

    # Delegate to the existing function logic
    result = generate_embeddings.local(
        full_audio_url=full_audio_url,
        stems_urls=stems_urls,
        analysis_id=analysis_id,
        segment_duration=segment_duration,
        segment_hop=segment_hop,
    )

    # Upload embeddings JSON to Supabase Storage for archival
    try:
        embeddings_json = json.dumps(result, sort_keys=True, default=str).encode("utf-8")
        remote_path = f"{user_id}/{analysis_id}/embeddings/embeddings.json"
        embeddings_url = upload_bytes_to_supabase(
            data=embeddings_json,
            remote_path=remote_path,
            bucket="spectra-audio",
            content_type="application/json",
        )
        result["embeddings_url"] = embeddings_url
        logger.info("Embeddings JSON uploaded to %s", embeddings_url)
    except Exception as exc:
        logger.warning("Failed to upload embeddings JSON to Supabase: %s", exc)
        result["embeddings_url"] = None

    return result
