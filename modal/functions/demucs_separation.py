"""
SPECTRA — Demucs Stem Separation
=================================
Modal function that runs the htdemucs_ft model to split a track into
four stems: vocals, bass, drums, other.

Determinism is enforced via fixed seeds and
``torch.use_deterministic_algorithms(True)``.
"""

from __future__ import annotations

import io
import logging
import os
import time
from typing import Any

import modal

from config import (
    CUBLAS_WORKSPACE_CONFIG,
    DEMUCS_MODEL,
    DEMUCS_TIMEOUT,
    RANDOM_SEED,
    TARGET_SAMPLE_RATE,
    TORCH_DETERMINISTIC,
    app,
    demucs_image,
    GPU_A10G,
)
from utils import hash_bytes, upload_bytes_to_supabase

logger = logging.getLogger("spectra.demucs")

STEM_NAMES = ("vocals", "bass", "drums", "other")


def _enforce_determinism() -> None:
    """Lock every source of non-determinism we can control."""
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


def _download_audio(url: str) -> bytes:
    import requests

    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    if len(resp.content) == 0:
        raise ValueError("Downloaded file is empty")
    return resp.content


def _separate(audio_bytes: bytes) -> dict[str, bytes]:
    """
    Run Demucs htdemucs_ft on raw audio bytes.

    Returns a dict mapping stem name -> WAV bytes.
    """
    import numpy as np
    import soundfile as sf
    import torch
    import torchaudio

    _enforce_determinism()

    # Load audio into tensor
    y, sr = torchaudio.load(io.BytesIO(audio_bytes))

    # Resample to model's expected rate if necessary
    from demucs.pretrained import get_model
    from demucs.apply import apply_model

    model = get_model(DEMUCS_MODEL)
    model.eval()

    if torch.cuda.is_available():
        model = model.cuda()
        y = y.cuda()

    # Demucs expects (batch, channels, samples)
    if y.dim() == 2:
        y = y.unsqueeze(0)

    with torch.no_grad():
        sources = apply_model(model, y, device=y.device, split=True, overlap=0.25)

    # sources shape: (batch, n_sources, channels, samples)
    sources = sources.squeeze(0).cpu().numpy()

    stem_map: dict[str, bytes] = {}
    source_names = model.sources  # canonical order from the model

    for idx, name in enumerate(source_names):
        stem_audio = sources[idx]  # (channels, samples)
        # Transpose to (samples, channels) for soundfile
        stem_audio = stem_audio.T

        buf = io.BytesIO()
        sf.write(buf, stem_audio, sr, subtype="PCM_16", format="WAV")
        stem_map[name] = buf.getvalue()

    return stem_map


@app.function(
    image=demucs_image,
    gpu=GPU_A10G,
    timeout=DEMUCS_TIMEOUT,
)
def demucs_separation(audio_url: str) -> dict[str, Any]:
    """
    Download audio from *audio_url* and separate into stems using
    Demucs htdemucs_ft.

    Returns
    -------
    dict with keys:
        stems : dict[str, bytes]  — stem name -> WAV bytes
        metadata : dict           — model info, timing, etc.
        processing_time_ms : float
    """
    t0 = time.perf_counter()

    try:
        logger.info("Downloading audio from %s", audio_url)
        raw_bytes = _download_audio(audio_url)
        logger.info("Downloaded %d bytes, starting separation", len(raw_bytes))

        stems = _separate(raw_bytes)

        elapsed_ms = (time.perf_counter() - t0) * 1000
        logger.info(
            "Separation complete in %.1f ms — stems: %s",
            elapsed_ms,
            list(stems.keys()),
        )

        metadata = {
            "model": DEMUCS_MODEL,
            "random_seed": RANDOM_SEED,
            "deterministic": TORCH_DETERMINISTIC,
            "stem_names": list(stems.keys()),
            "stem_sizes_bytes": {k: len(v) for k, v in stems.items()},
            "input_size_bytes": len(raw_bytes),
        }

        return {
            "stems": stems,
            "metadata": metadata,
            "processing_time_ms": round(elapsed_ms, 2),
        }

    except Exception:
        elapsed_ms = (time.perf_counter() - t0) * 1000
        logger.exception("Demucs separation failed after %.1f ms", elapsed_ms)
        raise


# ---------------------------------------------------------------------------
# HTTP Web Endpoint — called via POST from the TypeScript client
# ---------------------------------------------------------------------------

@app.function(
    image=demucs_image,
    gpu=GPU_A10G,
    timeout=DEMUCS_TIMEOUT,
)
@modal.fastapi_endpoint(method="POST")
def separate_stems(request: dict) -> dict:
    """
    HTTP POST endpoint for stem separation.

    Accepts JSON body:
        audio_url : str — URL to the audio file
        analysis_id : str — Analysis ID for path construction
        user_id : str — User ID for path construction
        pipeline_version : str — Pipeline version tag

    Separates stems via Demucs, uploads each stem WAV to Supabase Storage,
    and returns URLs + SHA-256 hashes for chain of custody.
    """
    audio_url = request["audio_url"]
    analysis_id = request["analysis_id"]
    user_id = request["user_id"]
    pipeline_version = request.get("pipeline_version", "v1")

    t0 = time.perf_counter()

    logger.info(
        "separate_stems endpoint: analysis=%s, user=%s", analysis_id, user_id
    )

    # Run the existing separation logic
    raw_bytes = _download_audio(audio_url)
    input_hash = hash_bytes(raw_bytes)
    stems = _separate(raw_bytes)

    # Upload each stem to Supabase and collect URLs + hashes
    stem_results: dict[str, Any] = {}
    for stem_name, wav_bytes in stems.items():
        stem_hash = hash_bytes(wav_bytes)
        remote_path = f"{user_id}/{analysis_id}/stems/{stem_name}.wav"

        stem_url = upload_bytes_to_supabase(
            data=wav_bytes,
            remote_path=remote_path,
            bucket="spectra-audio",
            content_type="audio/wav",
        )

        # Compute duration from WAV bytes
        try:
            import soundfile as sf
            info = sf.info(io.BytesIO(wav_bytes))
            duration_sec = info.duration
        except Exception:
            duration_sec = 0.0

        stem_results[stem_name] = {
            "url": stem_url,
            "hash": stem_hash,
            "duration_sec": duration_sec,
        }

    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info(
        "separate_stems complete in %.1f ms — stems: %s",
        elapsed_ms,
        list(stem_results.keys()),
    )

    return {
        "stems": stem_results,
        "model": DEMUCS_MODEL,
        "model_version": DEMUCS_MODEL,
        "processing_time_ms": round(elapsed_ms, 2),
        "input_hash": input_hash,
    }
