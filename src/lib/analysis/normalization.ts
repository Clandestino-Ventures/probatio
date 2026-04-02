/**
 * PROBATIO — Audio Normalization
 *
 * Configuration and validation for audio file normalization
 * prior to feature extraction. All analysis runs normalize
 * input audio to a canonical format for reproducibility.
 */

import {
  SUPPORTED_FORMATS,
  MAX_FILE_SIZE,
  MAX_DURATION_SECONDS,
  MIN_DURATION_SECONDS,
  type SupportedFormat,
} from "@/lib/constants";

// ────────────────────────────────────────────────────────────────────────────
// Normalization Configuration
// ────────────────────────────────────────────────────────────────────────────

/** Full normalization configuration including target format and loudness. */
export interface NormalizationConfig {
  /** Target sample rate in Hz. */
  sampleRate: number;
  /** Target bit depth. */
  bitDepth: number;
  /** Target number of audio channels (1 = mono, 2 = stereo). */
  channels: number;
  /** Output codec for the normalized file. */
  codec: "pcm_s16le" | "pcm_f32le" | "flac";
  /** Target integrated loudness in LUFS (null = skip loudness normalization). */
  targetLufs: number | null;
  /** Whether to apply a high-pass filter to remove DC offset. */
  removeDcOffset: boolean;
  /** High-pass filter cutoff in Hz (applied when removeDcOffset is true). */
  highPassCutoffHz: number;
}

/**
 * Default normalization parameters.
 *
 * - **44,100 Hz** sample rate (CD quality, widely supported).
 * - **16-bit** depth (sufficient for analysis; reduces memory usage).
 * - **Mono** (single channel simplifies comparison algorithms).
 * - **PCM signed 16-bit little-endian** codec.
 * - **-14 LUFS** target loudness (streaming standard).
 * - DC offset removal enabled at 20 Hz.
 */
export const DEFAULT_NORMALIZATION: Readonly<NormalizationConfig> = {
  sampleRate: 44100,
  bitDepth: 16,
  channels: 1,
  codec: "pcm_s16le",
  targetLufs: -14,
  removeDcOffset: true,
  highPassCutoffHz: 20,
} as const;

// ────────────────────────────────────────────────────────────────────────────
// Validation
// ────────────────────────────────────────────────────────────────────────────

/** Result of an audio file validation check. */
export interface AudioValidationResult {
  /** Whether the file passed all checks. */
  valid: boolean;
  /** List of human-readable error messages (empty when valid). */
  errors: string[];
}

/**
 * Validate an audio file before it enters the analysis pipeline.
 *
 * Checks:
 * 1. File format is in the supported list.
 * 2. File size does not exceed the maximum.
 * 3. Duration is within the allowed range (when provided).
 *
 * @param params.fileName         Original file name (used to extract extension).
 * @param params.fileSizeBytes    File size in bytes.
 * @param params.durationSeconds  Audio duration in seconds (optional; skipped if null).
 * @param params.maxFileSize      Override for maximum file size in bytes.
 * @returns An {@link AudioValidationResult}.
 */
export function validateAudioFile(params: {
  fileName: string;
  fileSizeBytes: number;
  durationSeconds?: number | null;
  maxFileSize?: number;
}): AudioValidationResult {
  const errors: string[] = [];
  const maxSize = params.maxFileSize ?? MAX_FILE_SIZE;

  // ── Format check ──────────────────────────────────────────────────────
  const extension = extractExtension(params.fileName);
  if (extension === null) {
    errors.push(
      `File name "${params.fileName}" has no extension. ` +
        `Supported formats: ${SUPPORTED_FORMATS.join(", ")}.`,
    );
  } else if (!isSupportedFormat(extension)) {
    errors.push(
      `Unsupported format "${extension}". ` +
        `Supported formats: ${SUPPORTED_FORMATS.join(", ")}.`,
    );
  }

  // ── Size check ────────────────────────────────────────────────────────
  if (params.fileSizeBytes <= 0) {
    errors.push("File is empty (0 bytes).");
  } else if (params.fileSizeBytes > maxSize) {
    const maxMB = (maxSize / (1024 * 1024)).toFixed(0);
    const fileMB = (params.fileSizeBytes / (1024 * 1024)).toFixed(1);
    errors.push(
      `File size (${fileMB} MB) exceeds the maximum allowed size (${maxMB} MB).`,
    );
  }

  // ── Duration check ────────────────────────────────────────────────────
  if (params.durationSeconds != null) {
    if (params.durationSeconds < MIN_DURATION_SECONDS) {
      errors.push(
        `Audio duration (${params.durationSeconds}s) is below the ` +
          `minimum of ${MIN_DURATION_SECONDS}s.`,
      );
    }
    if (params.durationSeconds > MAX_DURATION_SECONDS) {
      const maxMin = (MAX_DURATION_SECONDS / 60).toFixed(0);
      errors.push(
        `Audio duration (${params.durationSeconds}s) exceeds the ` +
          `maximum of ${maxMin} minutes.`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Extract the lowercase file extension from a file name.
 *
 * @returns Extension without the leading dot, or null if none found.
 */
function extractExtension(fileName: string): string | null {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1 || lastDot === fileName.length - 1) return null;
  return fileName.slice(lastDot + 1).toLowerCase();
}

/**
 * Type guard: check whether a string is a supported audio format.
 */
function isSupportedFormat(ext: string): ext is SupportedFormat {
  return (SUPPORTED_FORMATS as readonly string[]).includes(ext);
}
