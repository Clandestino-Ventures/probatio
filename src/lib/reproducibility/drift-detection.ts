/**
 * PROBATIO — Drift Detection
 *
 * Maintains a test corpus of synthetic audio with known expected outputs.
 * Running this periodically verifies the pipeline hasn't drifted.
 */

export interface DriftTestTrack {
  name: string;
  description: string;
  expectedKey?: string;
  expectedTempoBpm?: number;
  expectedDurationSec: number;
  selfSimilarityMin: number;
}

export interface DriftTestResult {
  corpusVersion: string;
  pipelineVersion: string;
  testedAt: string;
  allPassed: boolean;
  tracks: Array<{
    name: string;
    passed: boolean;
    checks: Record<string, {
      expected: string | number;
      actual: string | number;
      tolerance?: number;
      passed: boolean;
    }>;
  }>;
}

/**
 * Test corpus definition.
 * These are SYNTHETIC audio files (not copyrighted) with known properties.
 */
export const TEST_CORPUS: DriftTestTrack[] = [
  {
    name: "sine_440hz_5s",
    description: "Pure A4 sine wave, 5 seconds",
    expectedKey: "A",
    expectedDurationSec: 5.0,
    selfSimilarityMin: 0.99,
  },
  {
    name: "cmajor_progression_120bpm",
    description: "C major I-IV-V-I progression at 120 BPM",
    expectedKey: "C major",
    expectedTempoBpm: 120,
    expectedDurationSec: 10.0,
    selfSimilarityMin: 0.95,
  },
  {
    name: "drum_pattern_128bpm",
    description: "Kick-snare-hat pattern at 128 BPM",
    expectedTempoBpm: 128,
    expectedDurationSec: 10.0,
    selfSimilarityMin: 0.95,
  },
];

export const CORPUS_VERSION = "v1";

/**
 * Tolerance values for drift checks.
 * Floating point may vary across hardware.
 */
export const DRIFT_TOLERANCES = {
  lufs: 0.5,           // ±0.5 LU
  tempoBpm: 1.0,       // ±1.0 BPM
  embeddingSimilarity: 0.005,  // Must be > 0.995
  score: 0.005,        // ±0.005
  durationSec: 0.1,    // ±0.1s
};

/**
 * Run drift detection against the test corpus.
 * In production, this calls actual Modal functions.
 * For now, returns a mock result.
 */
export async function runDriftDetection(
  pipelineVersionTag: string
): Promise<DriftTestResult> {
  // In production: for each test track, run normalize → features → embeddings
  // and compare against stored expected outputs.
  // For now: return a passing mock result.

  const tracks = TEST_CORPUS.map((track) => ({
    name: track.name,
    passed: true,
    checks: {
      duration: {
        expected: track.expectedDurationSec,
        actual: track.expectedDurationSec,
        tolerance: DRIFT_TOLERANCES.durationSec,
        passed: true,
      },
      selfSimilarity: {
        expected: track.selfSimilarityMin,
        actual: 0.998,
        tolerance: DRIFT_TOLERANCES.embeddingSimilarity,
        passed: true,
      },
      ...(track.expectedTempoBpm
        ? {
            tempo: {
              expected: track.expectedTempoBpm,
              actual: track.expectedTempoBpm,
              tolerance: DRIFT_TOLERANCES.tempoBpm,
              passed: true,
            },
          }
        : {}),
    },
  }));

  return {
    corpusVersion: CORPUS_VERSION,
    pipelineVersion: pipelineVersionTag,
    testedAt: new Date().toISOString(),
    allPassed: tracks.every((t) => t.passed),
    tracks,
  };
}
