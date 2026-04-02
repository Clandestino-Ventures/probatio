/**
 * PROBATIO — Forensic Audio Normalization Wrapper
 *
 * Normalizes audio to EBU R128 (-14 LUFS) before analysis.
 * This ensures all comparisons are loudness-independent.
 */

import { callModalEndpoint } from "./client";
import { MODAL_ENDPOINTS } from "./endpoints";
import { isMockMode } from "./mock";

export interface NormalizationInput {
  audioUrl: string;
  analysisId: string;
  userId: string;
  targetLufs?: number;
  targetSampleRate?: number;
  targetChannels?: number;
  targetBitDepth?: number;
  peakCeilingDb?: number;
}

export interface AudioMetrics {
  sampleRate: number;
  channels: number;
  durationSec: number;
  format: string;
  integratedLufs: number | null;
  truePeakDbtp: number;
  loudnessRangeLu: number | null;
  bitDepth?: number;
  gainAppliedDb?: number;
}

export interface NormalizationOutput {
  normalizedUrl: string;
  normalizedHash: string;
  preNormalization: AudioMetrics;
  postNormalization: AudioMetrics;
  normalizationParams: {
    targetLufs: number;
    targetSampleRate: number;
    targetChannels: number;
    targetBitDepth: number;
    peakCeilingDb: number;
    standard: string;
    library: string;
  };
  inputHash: string;
  processingTimeMs: number;
}

export async function normalizeAudio(
  input: NormalizationInput
): Promise<NormalizationOutput> {
  if (isMockMode()) {
    return mockNormalizeAudio(input);
  }

  // The existing endpoint already handles normalization
  // Update it to also do LUFS normalization
  return callModalEndpoint<NormalizationInput, NormalizationOutput>(
    MODAL_ENDPOINTS.normalize,
    input
  );
}

function mockNormalizeAudio(input: NormalizationInput): NormalizationOutput {
  const fakeHash = (seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(16).padStart(64, "a").slice(0, 64);
  };

  return {
    normalizedUrl: `mock://normalized/${input.analysisId}/normalized.wav`,
    normalizedHash: fakeHash(input.analysisId + "normalized"),
    preNormalization: {
      sampleRate: 44100,
      channels: 2,
      durationSec: 214.5,
      format: "mp3",
      integratedLufs: -18.3,
      truePeakDbtp: -0.5,
      loudnessRangeLu: 8.2,
    },
    postNormalization: {
      sampleRate: input.targetSampleRate ?? 44100,
      channels: input.targetChannels ?? 1,
      durationSec: 214.5,
      format: "wav",
      integratedLufs: input.targetLufs ?? -14.0,
      truePeakDbtp: -1.2,
      loudnessRangeLu: 8.2,
      bitDepth: input.targetBitDepth ?? 24,
      gainAppliedDb: 4.3,
    },
    normalizationParams: {
      targetLufs: input.targetLufs ?? -14.0,
      targetSampleRate: input.targetSampleRate ?? 44100,
      targetChannels: input.targetChannels ?? 1,
      targetBitDepth: input.targetBitDepth ?? 24,
      peakCeilingDb: input.peakCeilingDb ?? -1.0,
      standard: "EBU R128",
      library: "pyloudnorm 0.1.1",
    },
    inputHash: fakeHash(input.analysisId + "input"),
    processingTimeMs: 1200,
  };
}
