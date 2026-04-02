"""
SPECTRA — Shared Modal Utilities
=================================
Common functions used across all ML functions: audio download, file hashing,
segment splitting, and numpy serialization.

These utilities are imported by demucs_fn, features_fn, and clap_fn.

Supabase upload requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
environment variables, passed via Modal Secrets.
"""

from __future__ import annotations

import hashlib
import io
import logging
import os
import tempfile
from typing import Any

logger = logging.getLogger("spectra.utils")


# ---------------------------------------------------------------------------
# Audio download
# ---------------------------------------------------------------------------

def download_audio(url: str, target_path: str | None = None) -> str:
    """
    Download audio from a URL (typically a Supabase signed URL) to a local
    temporary file.

    Parameters
    ----------
    url : str
        HTTP(S) URL to the audio file.
    target_path : str, optional
        Local path to save. If None, creates a temp file.

    Returns
    -------
    str — Local file path.

    Raises
    ------
    ValueError if the download is empty.
    requests.HTTPError on non-2xx response.
    """
    import requests

    resp = requests.get(url, timeout=120)
    resp.raise_for_status()

    if len(resp.content) == 0:
        raise ValueError(f"Downloaded file from {url} is empty")

    if target_path is None:
        suffix = ".wav"
        if ".flac" in url:
            suffix = ".flac"
        elif ".mp3" in url:
            suffix = ".mp3"
        fd, target_path = tempfile.mkstemp(suffix=suffix)
        os.close(fd)

    with open(target_path, "wb") as f:
        f.write(resp.content)

    logger.info("Downloaded %d bytes → %s", len(resp.content), target_path)
    return target_path


def download_audio_bytes(url: str) -> bytes:
    """Download audio from URL and return raw bytes."""
    import requests

    resp = requests.get(url, timeout=120)
    resp.raise_for_status()
    if len(resp.content) == 0:
        raise ValueError(f"Downloaded file from {url} is empty")
    return resp.content


# ---------------------------------------------------------------------------
# Hashing (SHA-256 for chain of custody)
# ---------------------------------------------------------------------------

def hash_file(file_path: str) -> str:
    """
    Compute SHA-256 hash of a file. Used for chain of custody — every
    intermediate artifact gets a hash that's recorded in the audit trail.

    Returns 64-character lowercase hex string.
    """
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def hash_bytes(data: bytes) -> str:
    """Compute SHA-256 hash of raw bytes. Returns 64-char hex string."""
    return hashlib.sha256(data).hexdigest()


def hash_json(obj: Any) -> str:
    """
    Compute SHA-256 hash of a JSON-serializable object.
    Sorts keys for deterministic output.
    """
    import json

    serialized = json.dumps(obj, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Audio segmentation
# ---------------------------------------------------------------------------

def segment_audio(
    audio_path: str,
    segment_duration: float,
    hop_duration: float,
    sr: int,
) -> list[dict[str, Any]]:
    """
    Split audio into overlapping segments for segment-level analysis.

    Each segment is a fixed-duration window with configurable hop (overlap).
    Default: 4s segments with 2s hop = 50% overlap.

    Parameters
    ----------
    audio_path : str
        Path to audio file (WAV/FLAC/MP3).
    segment_duration : float
        Duration of each segment in seconds.
    hop_duration : float
        Hop between segment starts in seconds.
    sr : int
        Target sample rate.

    Returns
    -------
    list of dicts, each with:
        index : int
        start_sec : float
        end_sec : float
        audio : numpy.ndarray  — mono audio samples
        sr : int
    """
    import librosa
    import numpy as np

    y, _ = librosa.load(audio_path, sr=sr, mono=True)
    total_duration = len(y) / sr

    segment_samples = int(segment_duration * sr)
    hop_samples = int(hop_duration * sr)

    segments = []
    idx = 0
    start = 0

    while start < len(y):
        end = min(start + segment_samples, len(y))
        segment_audio_data = y[start:end]

        # Pad short final segment with zeros to maintain consistent length
        if len(segment_audio_data) < segment_samples:
            segment_audio_data = np.pad(
                segment_audio_data,
                (0, segment_samples - len(segment_audio_data)),
                mode="constant",
            )

        segments.append({
            "index": idx,
            "start_sec": round(start / sr, 4),
            "end_sec": round(min(end / sr, total_duration), 4),
            "audio": segment_audio_data,
            "sr": sr,
        })

        idx += 1
        start += hop_samples

        # Stop if the remaining audio is too short to be meaningful
        if start >= len(y) - (sr // 4):  # less than 250ms remaining
            break

    logger.info(
        "Segmented %.1fs audio → %d segments (%.1fs window, %.1fs hop)",
        total_duration,
        len(segments),
        segment_duration,
        hop_duration,
    )
    return segments


def segment_audio_from_array(
    y: "numpy.ndarray",
    sr: int,
    segment_duration: float,
    hop_duration: float,
) -> list[dict[str, Any]]:
    """
    Same as segment_audio but accepts a numpy array directly
    (useful when audio is already loaded).
    """
    import numpy as np

    total_duration = len(y) / sr
    segment_samples = int(segment_duration * sr)
    hop_samples = int(hop_duration * sr)

    segments = []
    idx = 0
    start = 0

    while start < len(y):
        end = min(start + segment_samples, len(y))
        seg = y[start:end]

        if len(seg) < segment_samples:
            seg = np.pad(seg, (0, segment_samples - len(seg)), mode="constant")

        segments.append({
            "index": idx,
            "start_sec": round(start / sr, 4),
            "end_sec": round(min(end / sr, total_duration), 4),
            "audio": seg,
            "sr": sr,
        })

        idx += 1
        start += hop_samples
        if start >= len(y) - (sr // 4):
            break

    return segments


# ---------------------------------------------------------------------------
# Numpy serialization
# ---------------------------------------------------------------------------

def numpy_to_list(arr: Any) -> Any:
    """
    Recursively convert numpy arrays and scalars to Python-native types
    for JSON serialization.
    """
    import numpy as np

    if isinstance(arr, np.ndarray):
        return arr.tolist()
    if isinstance(arr, (np.floating, np.integer)):
        return arr.item()
    if isinstance(arr, dict):
        return {k: numpy_to_list(v) for k, v in arr.items()}
    if isinstance(arr, (list, tuple)):
        return [numpy_to_list(v) for v in arr]
    return arr


# ---------------------------------------------------------------------------
# Supabase Storage upload
# ---------------------------------------------------------------------------

def upload_to_supabase(
    local_path: str,
    remote_path: str,
    bucket: str = "spectra-audio",
    content_type: str = "audio/wav",
) -> str:
    """
    Upload a local file to Supabase Storage.

    Requires environment variables (passed via Modal Secrets):
    - SUPABASE_URL
    - SUPABASE_SERVICE_ROLE_KEY

    Returns the public URL of the uploaded file.
    """
    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_key:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in Modal Secrets"
        )

    upload_url = f"{supabase_url}/storage/v1/object/{bucket}/{remote_path}"

    with open(local_path, "rb") as f:
        file_data = f.read()

    import requests
    resp = requests.post(
        upload_url,
        headers={
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
            "Content-Type": content_type,
            "x-upsert": "true",
        },
        data=file_data,
        timeout=120,
    )
    resp.raise_for_status()

    # Return the public URL
    public_url = f"{supabase_url}/storage/v1/object/public/{bucket}/{remote_path}"
    logger.info("Uploaded %s → %s (%d bytes)", local_path, remote_path, len(file_data))
    return public_url


def upload_bytes_to_supabase(
    data: bytes,
    remote_path: str,
    bucket: str = "spectra-audio",
    content_type: str = "application/octet-stream",
) -> str:
    """Upload raw bytes to Supabase Storage. Returns public URL."""
    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")

    upload_url = f"{supabase_url}/storage/v1/object/{bucket}/{remote_path}"

    import requests
    resp = requests.post(
        upload_url,
        headers={
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
            "Content-Type": content_type,
            "x-upsert": "true",
        },
        data=data,
        timeout=120,
    )
    resp.raise_for_status()

    public_url = f"{supabase_url}/storage/v1/object/public/{bucket}/{remote_path}"
    return public_url
