/**
 * PROBATIO — Mock Modal Functions for Local Development
 *
 * When Modal.com endpoints are not deployed (MODAL_BASE_URL not set),
 * these mocks return realistic dummy data with correct types and shapes.
 * Includes fake processing delays (2-5 seconds) to simulate real pipeline.
 *
 * Usage: import { isMockMode } from '@/lib/modal/mock'
 * Check isMockMode() before calling callModalEndpoint — if true, use mocks.
 */

import type {
  NormalizeResponse,
  FingerprintResponse,
  SeparateResponse,
  StemResult,
  ExtractFeaturesResponse,
  GenerateEmbeddingsResponse,
} from "./endpoints";

// ────────────────────────────────────────────────────────────────────────────
// Detection
// ────────────────────────────────────────────────────────────────────────────

export function isMockMode(): boolean {
  return (
    !process.env.MODAL_BASE_URL && !process.env.MODAL_ENDPOINT_URL
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fakeHash(): string {
  return Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
}

function fakeEmbedding(dim: number = 512): number[] {
  // Random unit vector
  const raw = Array.from({ length: dim }, () => Math.random() - 0.5);
  const norm = Math.sqrt(raw.reduce((sum, v) => sum + v * v, 0));
  return raw.map((v) => v / norm);
}

// ────────────────────────────────────────────────────────────────────────────
// Mock Implementations
// ────────────────────────────────────────────────────────────────────────────

export async function mockNormalize(): Promise<NormalizeResponse> {
  await delay(1500);
  return {
    normalizedUrl: "mock://normalized/audio.wav",
    normalizedHash: fakeHash(),
    sampleRate: 44100,
    bitDepth: 16,
    channels: 1,
    durationSeconds: 210.5,
  };
}

export async function mockFingerprint(): Promise<FingerprintResponse> {
  await delay(2000);
  return {
    fingerprint: "AQAA" + fakeHash().substring(0, 40),
    fingerprintHash: fakeHash(),
    durationSec: 210.5,
    acoustidMatches: [],
    lookupTimeMs: 450,
  };
}

export async function mockSeparateStems(
  analysisId: string
): Promise<SeparateResponse> {
  await delay(4000); // Demucs is the slowest step

  const makeStem = (name: string): StemResult => ({
    url: `mock://stems/${analysisId}/${name}.wav`,
    hash: fakeHash(),
    durationSec: 210.5,
  });

  return {
    stems: {
      vocals: makeStem("vocals"),
      bass: makeStem("bass"),
      drums: makeStem("drums"),
      other: makeStem("other"),
    },
    model: "htdemucs_ft",
    modelVersion: "v4.0.1",
    processingTimeMs: 23500,
    inputHash: fakeHash(),
  };
}

export async function mockExtractFeatures(): Promise<ExtractFeaturesResponse> {
  await delay(3000);

  const numSegments = 52; // ~3.5 min track with 4s/2s hop

  return {
    trackLevel: {
      durationSec: 210.5,
      pitchContour: {
        timeS: Array.from({ length: 100 }, (_, i) => i * 0.01),
        frequencyHz: Array.from({ length: 100 }, () => 220 + Math.random() * 440),
        confidence: Array.from({ length: 100 }, () => 0.7 + Math.random() * 0.3),
        meanPitchHz: 330.5,
        pitchStdHz: 85.2,
        stepSizeMs: 10,
        modelCapacity: "full",
        sourceStem: "vocals",
      },
      chroma: {
        chromaCqt: Array.from({ length: 12 }, () =>
          Array.from({ length: 50 }, () => Math.random())
        ),
        nChroma: 12,
        shape: [12, 50],
        meanChroma: Array.from({ length: 12 }, () => Math.random()),
      },
      rhythm: {
        estimatedTempoBpm: 128.0,
        beatTimesS: Array.from({ length: 56 }, (_, i) => i * (60 / 128)),
        numBeats: 56,
        onsetStrengthMean: 0.45,
        onsetStrengthStd: 0.12,
        onsetEnvelope: Array.from({ length: 50 }, () => Math.random()),
      },
      structure: {
        segmentBoundaryTimesS: [0, 30.2, 62.5, 95.0, 128.3, 165.0, 195.5],
        numSegments: 8,
        noveltyCurve: Array.from({ length: 50 }, () => Math.random()),
      },
      key: {
        key: "C minor",
        confidence: 0.87,
        chromaProfile: Array.from({ length: 12 }, () => Math.random()),
      },
    },
    segments: Array.from({ length: numSegments }, (_, i) => ({
      index: i,
      startSec: i * 2,
      endSec: i * 2 + 4,
      label: null,
      features: {
        pitchContour: null,
        chromaVector: Array.from({ length: 12 }, () => Math.random()),
        onsetDensity: 2 + Math.random() * 4,
        rmsEnergy: 0.02 + Math.random() * 0.06,
        tempoLocal: 126 + Math.random() * 4,
      },
      perStem: {
        vocals: { onsetDensity: 2.1, rmsEnergy: 0.03, hasPitch: true },
        bass: { onsetDensity: 1.0, rmsEnergy: 0.05, hasPitch: true },
        drums: { onsetDensity: 4.5, rmsEnergy: 0.08, hasPitch: false },
        other: { onsetDensity: 1.5, rmsEnergy: 0.02, hasPitch: true },
      },
    })),
    modelVersions: {
      crepe: "0.0.16",
      crepeModelCapacity: "full",
      crepeStepSize: 10,
      librosa: "0.10.1",
      sampleRate: 44100,
    },
    outputHash: fakeHash(),
    processingTimeMs: 15200,
  };
}

export async function mockGenerateEmbeddings(): Promise<GenerateEmbeddingsResponse> {
  await delay(3000);

  const numSegments = 52;

  return {
    trackLevel: {
      timbre: { embedding: fakeEmbedding(), stem: "full_mix" },
      melody: { embedding: fakeEmbedding(), stem: "vocals" },
      harmony: { embedding: fakeEmbedding(), stem: "bass_other" },
      rhythm: { embedding: fakeEmbedding(), stem: "drums" },
    },
    segmentEmbeddings: Array.from({ length: numSegments }, (_, i) => ({
      index: i,
      startSec: i * 2,
      endSec: i * 2 + 4,
      embedding: fakeEmbedding(),
    })),
    model: "laion/larger_clap_music_and_speech",
    modelVersion: "laion/larger_clap_music_and_speech",
    embeddingDim: 512,
    outputHash: fakeHash(),
    processingTimeMs: 12300,
  };
}
