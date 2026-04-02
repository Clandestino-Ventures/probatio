"""
SPECTRA Modal Configuration
===========================
GPU assignments, model versions, determinism settings, and container image
definitions for all serverless audio-analysis functions.
"""

import modal

# ---------------------------------------------------------------------------
# Application stub
# ---------------------------------------------------------------------------
app = modal.App("spectra-forensic-audio")

# ---------------------------------------------------------------------------
# Pinned model versions
# ---------------------------------------------------------------------------
DEMUCS_MODEL = "htdemucs_ft"
CLAP_MODEL = "laion/larger_clap_music_and_speech"  # 630k-audioset-best
CREPE_MODEL_CAPACITY = "full"  # full capacity for maximum accuracy
WHISPER_MODEL = "large-v3"  # Pinned for forensic reproducibility
LYRICS_EMBEDDING_MODEL = "all-MiniLM-L6-v2"  # sentence-transformers
LYRICS_EMBEDDING_DIM = 512  # Padded from 384 to match CLAP/pgvector index

# ---------------------------------------------------------------------------
# Determinism
# ---------------------------------------------------------------------------
TORCH_DETERMINISTIC = True
RANDOM_SEED = 42
CUBLAS_WORKSPACE_CONFIG = ":4096:8"  # required for deterministic CUDA ops

# ---------------------------------------------------------------------------
# Timeouts (seconds)
# ---------------------------------------------------------------------------
NORMALIZE_TIMEOUT = 120
DEMUCS_TIMEOUT = 600
FEATURE_EXTRACTION_TIMEOUT = 300
CLAP_TIMEOUT = 300
FINGERPRINT_TIMEOUT = 120
WHISPER_TIMEOUT = 300
PDF_RENDER_TIMEOUT = 120

# ---------------------------------------------------------------------------
# Target audio format after normalization
# ---------------------------------------------------------------------------
TARGET_SAMPLE_RATE = 44100
TARGET_BIT_DEPTH = 16
TARGET_CHANNELS = 1  # mono

# ---------------------------------------------------------------------------
# Segment-level analysis
# Forensic cases require segment granularity: "bars 12-16 of Track A match
# bars 8-12 of Track B at 0.94 cosine similarity." These params control
# the windowed extraction used by feature_extraction and clap_embeddings.
# ---------------------------------------------------------------------------
# Legacy defaults (backward compat — existing analyses used these)
SEGMENT_DURATION_SEC = 4.0   # Window size for each segment
SEGMENT_HOP_SEC = 2.0        # Overlap between segments (50% at default)

# Multi-resolution analysis
RESOLUTIONS = {
    "bar": {
        "segment_duration_sec": 2.0,
        "segment_hop_sec": 1.0,
        "description": "Bar-level: catches short hooks and riffs (2-bar phrases)",
    },
    "phrase": {
        "segment_duration_sec": 8.0,
        "segment_hop_sec": 4.0,
        "description": "Phrase-level: catches verse/chorus copying (8-bar phrases)",
    },
    "song": {
        "segment_duration_sec": None,  # Full track — single segment
        "segment_hop_sec": None,
        "description": "Song-level: overall structural similarity",
    },
}
CLAP_EMBEDDING_DIM = 512     # CLAP output dimensionality
CLAP_SAMPLE_RATE = 48000     # CLAP expects 48kHz input

# ---------------------------------------------------------------------------
# Feature extraction params
# ---------------------------------------------------------------------------
CREPE_STEP_SIZE = 10          # milliseconds — higher resolution for forensic
CREPE_CONFIDENCE_THRESHOLD = 0.7
CHROMA_HOP_LENGTH = 512      # librosa chroma_cqt hop length

# ---------------------------------------------------------------------------
# Container images
# ---------------------------------------------------------------------------
base_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch==2.2.1",
        "torchaudio==2.2.1",
        "numpy==1.26.4",
        "requests==2.31.0",
        "soundfile==0.12.1",
    )
    .env({"CUBLAS_WORKSPACE_CONFIG": CUBLAS_WORKSPACE_CONFIG})
)

audio_normalize_image = base_image.pip_install(
    "librosa==0.10.1",
    "pyloudnorm==0.1.1",
)

# Normalization targets (EBU R128 forensic standard)
NORMALIZE_TARGET_LUFS = -14.0
NORMALIZE_PEAK_CEILING_DB = -1.0
NORMALIZE_STANDARD = "EBU R128"

demucs_image = base_image.pip_install(
    "demucs==4.0.1",
)

feature_extraction_image = base_image.pip_install(
    "librosa==0.10.1",
    "crepe==0.0.16",
)

clap_image = base_image.pip_install(
    "transformers==4.38.2",
    "librosa==0.10.1",
)

whisper_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install(
        "openai-whisper==20240930",
        "sentence-transformers==2.3.1",
        "torch==2.1.2",
        "numpy==1.26.4",
        "requests==2.31.0",
    )
    .env({"CUBLAS_WORKSPACE_CONFIG": CUBLAS_WORKSPACE_CONFIG})
)

fingerprint_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libchromaprint-tools", "libchromaprint-dev", "ffmpeg")
    .pip_install(
        "pyacoustid==1.3.0",
        "requests==2.31.0",
        "numpy==1.26.4",
        "soundfile==0.12.1",
        "librosa==0.10.1",
    )
)

pdf_render_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "wget",
        "gnupg",
        "ca-certificates",
        "fonts-liberation",
        "libasound2",
        "libatk-bridge2.0-0",
        "libatk1.0-0",
        "libcups2",
        "libdbus-1-3",
        "libdrm2",
        "libgbm1",
        "libgtk-3-0",
        "libnspr4",
        "libnss3",
        "libx11-xcb1",
        "libxcomposite1",
        "libxdamage1",
        "libxrandr2",
        "xdg-utils",
    )
    .run_commands(
        "wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -",
        'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list',
        "apt-get update && apt-get install -y google-chrome-stable",
    )
    .pip_install(
        "pyppeteer==2.0.0",
        "requests==2.31.0",
    )
    .run_commands("pyppeteer-install || true")
)

# ---------------------------------------------------------------------------
# GPU configurations
# ---------------------------------------------------------------------------
GPU_A10G = "A10G"
GPU_T4 = "T4"
