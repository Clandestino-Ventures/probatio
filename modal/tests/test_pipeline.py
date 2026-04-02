"""
SPECTRA — End-to-End Pipeline Tests
=====================================
Tests each Modal function independently using fixture audio, validates
normalization params, and verifies determinism (same input = same output).

Usage:
    pytest modal/tests/test_pipeline.py -v

These tests call the Modal functions *locally* (without deploying to Modal)
by invoking the underlying Python logic directly.
"""

from __future__ import annotations

import io
import os
import struct
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
import soundfile as sf


# ---------------------------------------------------------------------------
# Fixture: generate a synthetic test WAV
# ---------------------------------------------------------------------------
FIXTURE_SAMPLE_RATE = 44100
FIXTURE_DURATION_S = 3.0
FIXTURE_FREQ_HZ = 440.0  # A4


def _generate_sine_wav(
    sr: int = FIXTURE_SAMPLE_RATE,
    duration: float = FIXTURE_DURATION_S,
    freq: float = FIXTURE_FREQ_HZ,
    channels: int = 2,
    subtype: str = "PCM_24",
) -> bytes:
    """Generate a synthetic sine wave WAV for testing."""
    t = np.linspace(0, duration, int(sr * duration), endpoint=False, dtype=np.float32)
    mono = 0.5 * np.sin(2 * np.pi * freq * t)

    if channels == 2:
        audio = np.stack([mono, mono], axis=-1)
    else:
        audio = mono

    buf = io.BytesIO()
    sf.write(buf, audio, sr, subtype=subtype, format="WAV")
    return buf.getvalue()


@pytest.fixture
def fixture_audio_bytes() -> bytes:
    """Stereo 24-bit 44.1kHz sine wave."""
    return _generate_sine_wav()


@pytest.fixture
def fixture_audio_file(fixture_audio_bytes) -> str:
    """Write fixture to a temp file and return the path."""
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.write(fixture_audio_bytes)
    tmp.flush()
    tmp.close()
    yield tmp.name
    os.unlink(tmp.name)


@pytest.fixture
def fixture_mono_audio_bytes() -> bytes:
    """Mono 16-bit 22050Hz sine wave (different format for normalization testing)."""
    return _generate_sine_wav(sr=22050, channels=1, subtype="PCM_16")


# ---------------------------------------------------------------------------
# Helper: mock _download_audio so functions never hit the network
# ---------------------------------------------------------------------------
def _make_download_mock(audio_bytes: bytes):
    """Return a side_effect function that returns audio_bytes for any URL."""
    def _mock(url: str) -> bytes:
        return audio_bytes
    return _mock


# ---------------------------------------------------------------------------
# Tests: audio_normalize
# ---------------------------------------------------------------------------
class TestAudioNormalize:
    """Tests for the audio normalization function."""

    def test_normalize_produces_valid_wav(self, fixture_audio_bytes):
        """Normalization should produce a valid WAV at 44.1kHz/16-bit/mono."""
        from modal.functions.audio_normalize import _normalize

        wav_bytes, params = _normalize(fixture_audio_bytes)

        # Should be valid WAV
        info = sf.info(io.BytesIO(wav_bytes))
        assert info.samplerate == 44100
        assert info.channels == 1
        assert info.subtype == "PCM_16"

    def test_normalization_params_populated(self, fixture_audio_bytes):
        """All expected normalization params should be present."""
        from modal.functions.audio_normalize import _normalize

        _, params = _normalize(fixture_audio_bytes)

        required_keys = {
            "original_sample_rate",
            "original_channels",
            "original_subtype",
            "original_format",
            "original_duration_s",
            "original_frames",
            "target_sample_rate",
            "target_bit_depth",
            "target_channels",
            "peak_amplitude_before_norm",
            "normalized_length_samples",
            "normalized_duration_s",
            "output_size_bytes",
        }
        assert required_keys.issubset(set(params.keys()))

    def test_normalization_preserves_duration(self, fixture_audio_bytes):
        """Normalized duration should be close to original."""
        from modal.functions.audio_normalize import _normalize

        _, params = _normalize(fixture_audio_bytes)

        assert abs(params["normalized_duration_s"] - FIXTURE_DURATION_S) < 0.1

    def test_normalization_from_different_format(self, fixture_mono_audio_bytes):
        """Should handle 22050Hz mono input."""
        from modal.functions.audio_normalize import _normalize

        wav_bytes, params = _normalize(fixture_mono_audio_bytes)

        info = sf.info(io.BytesIO(wav_bytes))
        assert info.samplerate == 44100
        assert info.channels == 1
        assert params["original_sample_rate"] == 22050

    def test_normalization_determinism(self, fixture_audio_bytes):
        """Same input should produce identical output."""
        from modal.functions.audio_normalize import _normalize

        wav1, params1 = _normalize(fixture_audio_bytes)
        wav2, params2 = _normalize(fixture_audio_bytes)

        assert wav1 == wav2
        assert params1 == params2


# ---------------------------------------------------------------------------
# Tests: demucs_separation
# ---------------------------------------------------------------------------
class TestDemucs:
    """Tests for the Demucs stem separation function."""

    @pytest.mark.skipif(
        not os.environ.get("SPECTRA_TEST_GPU"),
        reason="Demucs requires GPU — set SPECTRA_TEST_GPU=1 to run",
    )
    def test_demucs_produces_four_stems(self, fixture_audio_bytes):
        """Demucs should produce vocals, bass, drums, other stems."""
        from modal.functions.demucs_separation import _separate

        stems = _separate(fixture_audio_bytes)

        assert set(stems.keys()) >= {"vocals", "bass", "drums", "other"}
        for name, data in stems.items():
            assert len(data) > 0, f"Stem '{name}' is empty"
            info = sf.info(io.BytesIO(data))
            assert info.samplerate > 0

    @pytest.mark.skipif(
        not os.environ.get("SPECTRA_TEST_GPU"),
        reason="Demucs requires GPU — set SPECTRA_TEST_GPU=1 to run",
    )
    def test_demucs_determinism(self, fixture_audio_bytes):
        """Same input should produce identical stems."""
        from modal.functions.demucs_separation import _separate

        stems1 = _separate(fixture_audio_bytes)
        stems2 = _separate(fixture_audio_bytes)

        for name in stems1:
            assert stems1[name] == stems2[name], f"Stem '{name}' differs between runs"


# ---------------------------------------------------------------------------
# Tests: feature_extraction
# ---------------------------------------------------------------------------
class TestFeatureExtraction:
    """Tests for the feature extraction pipeline."""

    def test_chroma_extraction(self, fixture_audio_bytes):
        """Chroma extraction should return 12-bin chroma features."""
        from modal.functions.feature_extraction import _extract_chroma
        import librosa

        y, sr = librosa.load(io.BytesIO(fixture_audio_bytes), sr=44100, mono=True)
        result = _extract_chroma(y, sr)

        assert result["n_chroma"] == 12
        assert len(result["mean_chroma"]) == 12
        assert result["shape"][0] == 12

    def test_rhythm_extraction(self, fixture_audio_bytes):
        """Rhythm extraction should estimate tempo and find beats."""
        from modal.functions.feature_extraction import _extract_rhythm
        import librosa

        y, sr = librosa.load(io.BytesIO(fixture_audio_bytes), sr=44100, mono=True)
        result = _extract_rhythm(y, sr)

        assert "estimated_tempo_bpm" in result
        assert isinstance(result["estimated_tempo_bpm"], float)
        assert result["estimated_tempo_bpm"] > 0

    def test_structure_extraction(self, fixture_audio_bytes):
        """Structure extraction should find segment boundaries."""
        from modal.functions.feature_extraction import _extract_structure
        import librosa

        y, sr = librosa.load(io.BytesIO(fixture_audio_bytes), sr=44100, mono=True)
        result = _extract_structure(y, sr)

        assert "num_segments" in result
        assert result["num_segments"] >= 1

    def test_feature_extraction_determinism(self, fixture_audio_bytes):
        """Same input should produce identical chroma features."""
        from modal.functions.feature_extraction import _extract_chroma
        import librosa

        y, sr = librosa.load(io.BytesIO(fixture_audio_bytes), sr=44100, mono=True)

        result1 = _extract_chroma(y, sr)
        result2 = _extract_chroma(y, sr)

        assert result1["mean_chroma"] == result2["mean_chroma"]


# ---------------------------------------------------------------------------
# Tests: clap_embeddings
# ---------------------------------------------------------------------------
class TestClapEmbeddings:
    """Tests for CLAP embedding generation."""

    @pytest.mark.skipif(
        not os.environ.get("SPECTRA_TEST_GPU"),
        reason="CLAP requires GPU — set SPECTRA_TEST_GPU=1 to run",
    )
    def test_clap_produces_512_dim_embedding(self, fixture_audio_bytes):
        """CLAP should produce a 512-dimensional unit vector."""
        from modal.functions.clap_embeddings import _compute_embedding, _load_audio

        audio_array = _load_audio(fixture_audio_bytes)
        embedding = _compute_embedding(audio_array)

        assert len(embedding) == 512
        # Should be unit-normalized
        norm = np.linalg.norm(embedding)
        assert abs(norm - 1.0) < 1e-4

    @pytest.mark.skipif(
        not os.environ.get("SPECTRA_TEST_GPU"),
        reason="CLAP requires GPU — set SPECTRA_TEST_GPU=1 to run",
    )
    def test_clap_determinism(self, fixture_audio_bytes):
        """Same input should produce identical embeddings."""
        from modal.functions.clap_embeddings import _compute_embedding, _load_audio

        audio_array = _load_audio(fixture_audio_bytes)
        emb1 = _compute_embedding(audio_array)
        emb2 = _compute_embedding(audio_array)

        np.testing.assert_array_almost_equal(emb1, emb2, decimal=6)


# ---------------------------------------------------------------------------
# Tests: fingerprint
# ---------------------------------------------------------------------------
class TestFingerprint:
    """Tests for Chromaprint fingerprinting."""

    @pytest.mark.skipif(
        not os.environ.get("SPECTRA_TEST_FINGERPRINT"),
        reason="Requires libchromaprint — set SPECTRA_TEST_FINGERPRINT=1 to run",
    )
    def test_fingerprint_produces_string(self, fixture_audio_bytes):
        """Fingerprint should return a non-empty string."""
        from modal.functions.fingerprint import _compute_fingerprint

        duration, fp = _compute_fingerprint(fixture_audio_bytes)

        assert isinstance(fp, str)
        assert len(fp) > 0
        assert duration > 0

    @pytest.mark.skipif(
        not os.environ.get("SPECTRA_TEST_FINGERPRINT"),
        reason="Requires libchromaprint — set SPECTRA_TEST_FINGERPRINT=1 to run",
    )
    def test_fingerprint_determinism(self, fixture_audio_bytes):
        """Same input should produce identical fingerprint."""
        from modal.functions.fingerprint import _compute_fingerprint

        _, fp1 = _compute_fingerprint(fixture_audio_bytes)
        _, fp2 = _compute_fingerprint(fixture_audio_bytes)

        assert fp1 == fp2


# ---------------------------------------------------------------------------
# Tests: pdf_render
# ---------------------------------------------------------------------------
class TestPdfRender:
    """Tests for PDF rendering."""

    @pytest.mark.skipif(
        not os.environ.get("SPECTRA_TEST_PDF"),
        reason="Requires Chromium — set SPECTRA_TEST_PDF=1 to run",
    )
    def test_pdf_render_produces_bytes(self):
        """Should render HTML to a valid PDF."""
        import asyncio
        from modal.functions.pdf_render import _render_html_to_pdf

        html = "<html><body><h1>SPECTRA Forensic Report</h1><p>Test content.</p></body></html>"
        pdf_bytes = asyncio.get_event_loop().run_until_complete(
            _render_html_to_pdf(html)
        )

        assert len(pdf_bytes) > 0
        # PDF magic bytes
        assert pdf_bytes[:5] == b"%PDF-"

    @pytest.mark.skipif(
        not os.environ.get("SPECTRA_TEST_PDF"),
        reason="Requires Chromium — set SPECTRA_TEST_PDF=1 to run",
    )
    def test_pdf_render_rejects_empty_html(self):
        """Should raise ValueError for empty HTML."""
        from modal.functions.pdf_render import pdf_render

        with pytest.raises(ValueError, match="non-empty"):
            pdf_render.local("")


# ---------------------------------------------------------------------------
# Tests: full pipeline integration
# ---------------------------------------------------------------------------
class TestPipelineIntegration:
    """Integration tests that chain multiple functions together."""

    def test_normalize_then_extract_features(self, fixture_audio_bytes):
        """Normalization output should be valid input for feature extraction."""
        from modal.functions.audio_normalize import _normalize
        from modal.functions.feature_extraction import _extract_chroma
        import librosa

        wav_bytes, _ = _normalize(fixture_audio_bytes)

        # Load normalized audio and extract chroma
        y, sr = librosa.load(io.BytesIO(wav_bytes), sr=44100, mono=True)
        chroma = _extract_chroma(y, sr)

        assert chroma["n_chroma"] == 12
        assert len(chroma["mean_chroma"]) == 12

    def test_full_pipeline_determinism(self, fixture_audio_bytes):
        """Full normalize -> extract chain should be deterministic."""
        from modal.functions.audio_normalize import _normalize
        from modal.functions.feature_extraction import _extract_chroma, _extract_rhythm
        import librosa

        # Run 1
        wav1, _ = _normalize(fixture_audio_bytes)
        y1, sr1 = librosa.load(io.BytesIO(wav1), sr=44100, mono=True)
        chroma1 = _extract_chroma(y1, sr1)
        rhythm1 = _extract_rhythm(y1, sr1)

        # Run 2
        wav2, _ = _normalize(fixture_audio_bytes)
        y2, sr2 = librosa.load(io.BytesIO(wav2), sr=44100, mono=True)
        chroma2 = _extract_chroma(y2, sr2)
        rhythm2 = _extract_rhythm(y2, sr2)

        assert chroma1["mean_chroma"] == chroma2["mean_chroma"]
        assert rhythm1["estimated_tempo_bpm"] == rhythm2["estimated_tempo_bpm"]
