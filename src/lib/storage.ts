// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Supabase Storage Helpers
 *
 * Utilities for generating storage paths, signed URLs, and managing
 * audio files in Supabase Storage. Used by the upload API, Inngest
 * pipeline, and cleanup jobs.
 *
 * Storage structure:
 *   {user_id}/{analysis_id}/original/{file_name}    — uploaded audio
 *   {user_id}/{analysis_id}/stems/{stem_name}.wav   — Demucs output
 *   {user_id}/{analysis_id}/features/raw.json       — full resolution features
 *   {user_id}/{analysis_id}/reports/{report_name}    — generated reports
 *   {user_id}/{analysis_id}/evidence/{package_name}  — forensic evidence packages
 */

import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "spectra-audio";

// ────────────────────────────────────────────────────────────────────────────
// Path Generation
// ────────────────────────────────────────────────────────────────────────────

type StorageType = "original" | "stems" | "features" | "reports" | "evidence";

/**
 * Generate a deterministic storage path for an analysis artifact.
 */
export function generateStoragePath(
  userId: string,
  analysisId: string,
  type: StorageType,
  filename: string
): string {
  return `${userId}/${analysisId}/${type}/${filename}`;
}

/**
 * Generate stem storage paths for all 4 Demucs stems.
 */
export function generateStemPaths(userId: string, analysisId: string) {
  return {
    vocals: generateStoragePath(userId, analysisId, "stems", "vocals.wav"),
    bass: generateStoragePath(userId, analysisId, "stems", "bass.wav"),
    drums: generateStoragePath(userId, analysisId, "stems", "drums.wav"),
    other: generateStoragePath(userId, analysisId, "stems", "other.wav"),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Signed URLs
// ────────────────────────────────────────────────────────────────────────────

/**
 * Create a signed URL for downloading a file from Supabase Storage.
 * Used to pass audio URLs to Modal functions (they need to download the file).
 *
 * @param path - Storage path (e.g. "user_id/analysis_id/original/track.mp3")
 * @param expiresIn - Seconds until URL expires (default: 3600 = 1 hour)
 */
export async function getSignedUrl(
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL for ${path}: ${error?.message || "unknown error"}`);
  }

  return data.signedUrl;
}

/**
 * Get the public URL for a file. Used for permanently accessible files
 * like reports and evidence packages.
 */
export function getPublicUrl(path: string): string {
  const supabase = createAdminClient();
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ────────────────────────────────────────────────────────────────────────────
// Upload Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Upload a JSON object to Supabase Storage. Used for archiving raw features
 * at full resolution (forensic reproducibility requirement).
 */
export async function uploadJsonToStorage(
  path: string,
  data: unknown
): Promise<string> {
  const supabase = createAdminClient();

  const jsonString = JSON.stringify(data);
  const blob = new Blob([jsonString], { type: "application/json" });

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: "application/json",
    upsert: true, // safe for retries
  });

  if (error) {
    throw new Error(`Failed to upload JSON to ${path}: ${error.message}`);
  }

  return getPublicUrl(path);
}

// ────────────────────────────────────────────────────────────────────────────
// Cleanup
// ────────────────────────────────────────────────────────────────────────────

/**
 * Delete all files for an analysis. Used on permanent pipeline failure
 * or when a user deletes their analysis.
 */
export async function deleteAnalysisFiles(
  userId: string,
  analysisId: string
): Promise<void> {
  const supabase = createAdminClient();
  const prefix = `${userId}/${analysisId}/`;

  const { data: files } = await supabase.storage.from(BUCKET).list(prefix, {
    limit: 100,
  });

  if (files && files.length > 0) {
    const paths = files.map((f) => `${prefix}${f.name}`);
    await supabase.storage.from(BUCKET).remove(paths);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────────────────

/**
 * Downsample an array to at most maxPoints elements.
 * Keeps every Nth element. Used for summary features in JSONB
 * (full resolution goes to Storage as raw JSON).
 */
export function downsample<T>(arr: T[], maxPoints: number): T[] {
  if (arr.length <= maxPoints) return arr;
  const step = Math.ceil(arr.length / maxPoints);
  return arr.filter((_, i) => i % step === 0);
}
