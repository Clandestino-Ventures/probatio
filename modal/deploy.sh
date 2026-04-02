#!/bin/bash
# ============================================================================
# SPECTRA — Deploy Modal.com ML Functions
# ============================================================================
# Usage: cd modal && bash deploy.sh
#
# Prerequisites:
#   pip install modal
#   modal token new  (authenticate with Modal.com)
#
# Required Modal Secret: "spectra-supabase"
#   SUPABASE_URL=<your_supabase_url>
#   SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
#
# Create at: https://modal.com/secrets
# ============================================================================

set -e

echo "╔══════════════════════════════════════════════╗"
echo "║  SPECTRA — Deploying ML Functions to Modal   ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Check modal CLI
if ! command -v modal &> /dev/null; then
    echo "❌ modal CLI not found. Install: pip install modal"
    exit 1
fi

echo "[1/7] Deploying audio normalization..."
modal deploy functions/audio_normalize.py
echo "  ✓ audio_normalize deployed"

echo "[2/7] Deploying Demucs stem separation..."
modal deploy functions/demucs_separation.py
echo "  ✓ demucs_separation deployed"

echo "[3/7] Deploying feature extraction (CREPE + librosa)..."
modal deploy functions/feature_extraction.py
echo "  ✓ feature_extraction deployed"

echo "[4/7] Deploying CLAP embeddings (multi-dimensional)..."
modal deploy functions/clap_embeddings.py
echo "  ✓ clap_embeddings deployed"

echo "[5/7] Deploying Whisper lyrics extraction..."
modal deploy functions/whisper_lyrics.py
echo "  ✓ whisper_lyrics deployed"

echo "[6/7] Deploying Chromaprint fingerprinting..."
modal deploy functions/fingerprint.py
echo "  ✓ fingerprint deployed"

echo "[7/7] Deploying PDF renderer..."
modal deploy functions/pdf_render.py
echo "  ✓ pdf_render deployed"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✅ All 7 functions deployed successfully    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Verify at: https://modal.com/apps"
echo ""
echo "Pinned model versions (DO NOT CHANGE without new pipeline_version):"
echo "  Demucs:   htdemucs_ft v4.0.1"
echo "  CREPE:    full capacity v0.0.16"
echo "  CLAP:     laion/larger_clap_music_and_speech"
echo "  Whisper:  large-v3 (openai-whisper 20240930)"
echo "  MiniLM:   all-MiniLM-L6-v2 (384→512 padded)"
echo "  librosa:  0.10.1"
