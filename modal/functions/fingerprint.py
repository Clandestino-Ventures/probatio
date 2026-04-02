"""
SPECTRA — Audio Fingerprinting
================================
Modal function that computes a Chromaprint fingerprint and optionally
performs an AcoustID lookup.

Runs on CPU — no GPU required.
"""

from __future__ import annotations

import io
import logging
import tempfile
import time
from typing import Any

import modal

from config import (
    FINGERPRINT_TIMEOUT,
    TARGET_SAMPLE_RATE,
    app,
    fingerprint_image,
)
from utils import hash_bytes

logger = logging.getLogger("spectra.fingerprint")

# AcoustID API key — set via Modal secret or env var at deploy time
ACOUSTID_API_KEY_ENV = "ACOUSTID_API_KEY"


def _download_audio(url: str) -> bytes:
    import requests

    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    if len(resp.content) == 0:
        raise ValueError("Downloaded file is empty")
    return resp.content


def _compute_fingerprint(audio_bytes: bytes) -> tuple[int, str]:
    """
    Compute Chromaprint fingerprint from audio bytes.

    Returns (duration_seconds, fingerprint_string).
    """
    import acoustid
    import numpy as np
    import soundfile as sf

    # Write audio to a temp file because acoustid.fingerprint_file needs a path
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        duration, fingerprint = acoustid.fingerprint_file(tmp_path)
    finally:
        import os
        os.unlink(tmp_path)

    return int(duration), fingerprint


def _acoustid_lookup(duration: int, fingerprint: str) -> dict[str, Any] | None:
    """
    Look up fingerprint against the AcoustID database.

    Returns match results or None if the API key is not configured.
    """
    import os

    api_key = os.environ.get(ACOUSTID_API_KEY_ENV)
    if not api_key:
        logger.warning(
            "ACOUSTID_API_KEY not set — skipping AcoustID lookup. "
            "Set the %s env var or Modal secret to enable.",
            ACOUSTID_API_KEY_ENV,
        )
        return None

    import acoustid

    try:
        results = acoustid.lookup(
            api_key,
            fingerprint,
            duration,
            meta="recordings releasegroups",
        )

        matches = []
        for result in results.get("results", []):
            match_entry = {
                "acoustid_id": result.get("id"),
                "score": result.get("score"),
                "recordings": [],
            }
            for rec in result.get("recordings", []):
                match_entry["recordings"].append({
                    "musicbrainz_id": rec.get("id"),
                    "title": rec.get("title"),
                    "artists": [
                        a.get("name") for a in rec.get("artists", [])
                    ],
                    "duration_s": rec.get("duration"),
                    "release_groups": [
                        {
                            "title": rg.get("title"),
                            "type": rg.get("type"),
                        }
                        for rg in rec.get("releasegroups", [])
                    ],
                })
            matches.append(match_entry)

        return {"matches": matches, "total_results": len(matches)}

    except Exception as exc:
        logger.warning("AcoustID lookup failed: %s", exc)
        return {"error": str(exc), "matches": []}


@app.function(
    image=fingerprint_image,
    timeout=FINGERPRINT_TIMEOUT,
)
def fingerprint(audio_url: str) -> dict[str, Any]:
    """
    Download audio from *audio_url*, compute a Chromaprint fingerprint,
    and perform an AcoustID lookup.

    Returns
    -------
    dict with keys:
        fingerprint : str        — Chromaprint fingerprint string
        duration_s  : int        — duration in seconds
        acoustid    : dict|None  — AcoustID lookup results (if API key set)
        processing_time_ms : float
    """
    t0 = time.perf_counter()

    try:
        logger.info("Downloading audio from %s", audio_url)
        raw_bytes = _download_audio(audio_url)
        logger.info("Downloaded %d bytes, computing fingerprint", len(raw_bytes))

        duration, fp_string = _compute_fingerprint(raw_bytes)
        logger.info("Fingerprint computed: duration=%ds, fp_len=%d", duration, len(fp_string))

        acoustid_result = _acoustid_lookup(duration, fp_string)

        elapsed_ms = (time.perf_counter() - t0) * 1000
        logger.info("Fingerprinting complete in %.1f ms", elapsed_ms)

        return {
            "fingerprint": fp_string,
            "duration_s": duration,
            "acoustid": acoustid_result,
            "processing_time_ms": round(elapsed_ms, 2),
        }

    except Exception:
        elapsed_ms = (time.perf_counter() - t0) * 1000
        logger.exception("Fingerprinting failed after %.1f ms", elapsed_ms)
        raise


# ---------------------------------------------------------------------------
# HTTP Web Endpoint — called via POST from the TypeScript client
# ---------------------------------------------------------------------------

@app.function(
    image=fingerprint_image,
    timeout=FINGERPRINT_TIMEOUT,
)
@modal.fastapi_endpoint(method="POST")
def fingerprint_endpoint(request: dict) -> dict:
    """
    HTTP POST endpoint for audio fingerprinting.

    Accepts JSON body:
        file_url : str — URL to the audio file
        file_hash : str — SHA-256 hash of the file

    Computes Chromaprint fingerprint, performs AcoustID lookup,
    and returns results.
    """
    file_url = request["file_url"]
    file_hash = request.get("file_hash", "")

    t0 = time.perf_counter()

    logger.info("fingerprint_endpoint: url=%s, hash=%s", file_url, file_hash[:16] if file_hash else "none")

    raw_bytes = _download_audio(file_url)
    duration, fp_string = _compute_fingerprint(raw_bytes)
    fingerprint_hash = hash_bytes(fp_string.encode("utf-8"))

    acoustid_result = _acoustid_lookup(duration, fp_string)

    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info("fingerprint_endpoint complete in %.1f ms", elapsed_ms)

    return {
        "fingerprint": fp_string,
        "fingerprint_hash": fingerprint_hash,
        "duration_sec": duration,
        "acoustid_matches": acoustid_result.get("matches", []) if acoustid_result else [],
        "lookup_time_ms": round(elapsed_ms, 2),
    }
