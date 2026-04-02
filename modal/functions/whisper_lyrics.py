"""
SPECTRA — Whisper Lyrics Extraction + Text Embedding
=====================================================
Modal function that transcribes vocals using Whisper large-v3 LOCAL inference,
then generates a 512-dimensional text embedding for pgvector similarity search.

This is the 5th forensic dimension: LYRICS. When a court asks "were the words
copied?", Probatio has a quantitative answer backed by vector similarity.

Whisper runs LOCAL on Modal GPU — audio never leaves our infrastructure.
Forensic chain of custody requires we control the compute.

Embedding: sentence-transformers all-MiniLM-L6-v2 produces 384-dim vectors,
padded to 512 to match CLAP embedding dimensions and the pgvector index on
spectral_signatures. Cosine similarity ignores zero dimensions — this is
mathematically correct.

GPU: T4
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
import time
from typing import Any

import modal

from ..config import (
    CUBLAS_WORKSPACE_CONFIG,
    LYRICS_EMBEDDING_DIM,
    LYRICS_EMBEDDING_MODEL,
    RANDOM_SEED,
    TORCH_DETERMINISTIC,
    WHISPER_MODEL,
    WHISPER_TIMEOUT,
    app,
    whisper_image,
    GPU_T4,
)
from ..utils import (
    download_audio,
    hash_json,
    numpy_to_list,
)

logger = logging.getLogger("spectra.whisper_lyrics")


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
        torch.use_deterministic_algorithms(True, warn_only=True)
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False

    os.environ["CUBLAS_WORKSPACE_CONFIG"] = CUBLAS_WORKSPACE_CONFIG


# ---------------------------------------------------------------------------
# Model caches
# ---------------------------------------------------------------------------

_whisper_cache: dict[str, Any] = {}
_embedding_cache: dict[str, Any] = {}


def _get_whisper_model():
    """Load and cache Whisper large-v3 model."""
    import torch
    import whisper

    if "model" not in _whisper_cache:
        logger.info("Loading Whisper model: %s", WHISPER_MODEL)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = whisper.load_model(WHISPER_MODEL, device=device)
        _whisper_cache["model"] = model
        _whisper_cache["device"] = device
        logger.info("Whisper %s loaded on %s", WHISPER_MODEL, device)

    return _whisper_cache["model"]


def _get_embedding_model():
    """Load and cache sentence-transformers embedding model."""
    from sentence_transformers import SentenceTransformer

    if "model" not in _embedding_cache:
        logger.info("Loading embedding model: %s", LYRICS_EMBEDDING_MODEL)
        model = SentenceTransformer(LYRICS_EMBEDDING_MODEL)
        _embedding_cache["model"] = model
        logger.info("Embedding model loaded: %s", LYRICS_EMBEDDING_MODEL)

    return _embedding_cache["model"]


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

def _transcribe(audio_path: str, language_hint: str | None) -> dict[str, Any]:
    """
    Transcribe audio using Whisper large-v3 with word-level timestamps.

    Returns dict with keys: text, language, segments, word_timestamps.
    """
    _enforce_determinism()
    model = _get_whisper_model()

    transcribe_opts: dict[str, Any] = {
        "word_timestamps": True,
        "verbose": False,
    }
    if language_hint:
        transcribe_opts["language"] = language_hint

    result = model.transcribe(audio_path, **transcribe_opts)

    # Extract word timestamps from segments
    word_timestamps = []
    for segment in result.get("segments", []):
        for word_info in segment.get("words", []):
            word_timestamps.append({
                "word": word_info["word"].strip(),
                "start": round(word_info["start"], 3),
                "end": round(word_info["end"], 3),
            })

    # Build clean segments list
    segments = []
    for seg in result.get("segments", []):
        segments.append({
            "text": seg["text"].strip(),
            "start": round(seg["start"], 3),
            "end": round(seg["end"], 3),
        })

    return {
        "text": result["text"].strip(),
        "language": result.get("language", "unknown"),
        "segments": segments,
        "word_timestamps": word_timestamps,
    }


def _compute_lyrics_embedding(text: str) -> list[float]:
    """
    Compute a 512-dimensional text embedding from lyrics text.

    all-MiniLM-L6-v2 produces 384-dim vectors. We pad to 512 with zeros
    to match CLAP embedding dimensions and the pgvector index.
    Cosine similarity ignores zero dimensions — mathematically correct.

    The embedding is L2-normalized before padding so the non-zero portion
    has unit length.
    """
    import numpy as np

    model = _get_embedding_model()

    # Encode the full lyrics text
    embedding_384 = model.encode(text, normalize_embeddings=True)

    # Pad from 384 to 512 with zeros
    padded = np.zeros(LYRICS_EMBEDDING_DIM, dtype=np.float32)
    padded[:len(embedding_384)] = embedding_384

    return padded.tolist()


# ---------------------------------------------------------------------------
# Main Modal function
# ---------------------------------------------------------------------------

@app.function(
    image=whisper_image,
    gpu=GPU_T4,
    timeout=WHISPER_TIMEOUT,
    retries=1,
)
def extract_lyrics(
    vocals_url: str,
    analysis_id: str,
    language_hint: str | None = None,
) -> dict[str, Any]:
    """
    Transcribe isolated vocals using Whisper large-v3 and generate a
    512-dimensional text embedding for pgvector similarity search.

    Parameters
    ----------
    vocals_url : str
        Supabase signed URL to the isolated vocals WAV from Demucs.
    analysis_id : str
        For traceability and logging.
    language_hint : str, optional
        ISO 639-1 code (e.g., "en", "es"). If None, Whisper auto-detects.

    Returns
    -------
    dict with keys:
        lyrics_text, lyrics_language, lyrics_embedding (512 floats),
        word_timestamps, segments, whisper_model, embedding_model,
        output_hash, processing_time_ms
    """
    start_time = time.time()
    logger.info(
        "extract_lyrics called: analysis_id=%s, language_hint=%s",
        analysis_id,
        language_hint,
    )

    # Download vocals to local temp file
    local_path = download_audio(vocals_url)
    logger.info("Downloaded vocals: %s", local_path)

    # Transcribe with Whisper large-v3
    transcription = _transcribe(local_path, language_hint)
    logger.info(
        "Transcription complete: %d chars, language=%s, %d segments",
        len(transcription["text"]),
        transcription["language"],
        len(transcription["segments"]),
    )

    # Generate text embedding (384-dim padded to 512)
    lyrics_text = transcription["text"]
    if len(lyrics_text.strip()) == 0:
        # Instrumental track — no lyrics detected
        import numpy as np
        lyrics_embedding = np.zeros(LYRICS_EMBEDDING_DIM, dtype=np.float32).tolist()
        logger.info("No lyrics detected — returning zero embedding")
    else:
        lyrics_embedding = _compute_lyrics_embedding(lyrics_text)
        logger.info("Embedding computed: %d dimensions", len(lyrics_embedding))

    # Build output
    processing_time_ms = int((time.time() - start_time) * 1000)

    output = {
        "lyrics_text": lyrics_text,
        "lyrics_language": transcription["language"],
        "lyrics_embedding": lyrics_embedding,
        "word_timestamps": transcription["word_timestamps"],
        "segments": transcription["segments"],
        "whisper_model": WHISPER_MODEL,
        "embedding_model": LYRICS_EMBEDDING_MODEL,
        "processing_time_ms": processing_time_ms,
    }

    # SHA-256 hash of the full output for chain of custody
    output["output_hash"] = hash_json(output)

    logger.info(
        "extract_lyrics complete: %d ms, hash=%s",
        processing_time_ms,
        output["output_hash"][:16],
    )

    # Clean up temp file
    try:
        os.unlink(local_path)
    except OSError:
        pass

    return output
