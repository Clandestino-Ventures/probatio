// @ts-nocheck — Supabase query types will be auto-generated
/**
 * PROBATIO — Data Retention Scheduled Jobs
 *
 * Two functions:
 * 1. sendDeletionWarnings: daily at 8 AM, warns users 7 days before expiry
 * 2. deleteExpiredAudio: daily at 3 AM, deletes expired audio files
 *
 * Deletion preserves: results, matches, evidence, custody chain, report, embeddings
 * Deletion removes: original audio, normalized audio, stems, raw features
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { recordCustody } from "@/lib/custody";

/**
 * Extract Supabase Storage path from a URL.
 */
function extractStoragePath(url: string): string | null {
  if (!url) return null;
  try {
    const match = url.match(/spectra-audio\/(.+?)(\?|$)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

/**
 * Find analyses expiring within 7 days that haven't been notified.
 * Returns count of users notified.
 */
export async function processRetentionWarnings(): Promise<{
  notifiedAnalyses: number;
  usersNotified: number;
}> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: expiring } = await supabase
    .from("analyses")
    .select("id, user_id, file_name, audio_expires_at, mode")
    .gt("audio_expires_at", now)
    .lte("audio_expires_at", sevenDaysFromNow)
    .is("audio_deleted_at", null)
    .eq("deletion_notified", false)
    .limit(500);

  if (!expiring || expiring.length === 0) {
    return { notifiedAnalyses: 0, usersNotified: 0 };
  }

  // Group by user
  const byUser = new Map<string, typeof expiring>();
  for (const a of expiring) {
    if (!byUser.has(a.user_id)) byUser.set(a.user_id, []);
    byUser.get(a.user_id)!.push(a);
  }

  let notifiedAnalyses = 0;

  for (const [userId, analyses] of byUser) {
    // Mark as notified
    const ids = analyses.map((a) => a.id);
    await supabase
      .from("analyses")
      .update({
        deletion_notified: true,
        deletion_notification_sent_at: now,
      })
      .in("id", ids);

    // Record custody for each
    for (const analysis of analyses) {
      await recordCustody({
        entityType: "analysis",
        entityId: analysis.id,
        action: "file_deletion_notified",
        actorId: userId,
        detail: {
          step_name: "retention_notification",
          expires_at: analysis.audio_expires_at,
          notification_type: "scheduled",
        },
      });
    }

    notifiedAnalyses += analyses.length;
  }

  return { notifiedAnalyses, usersNotified: byUser.size };
}

/**
 * Delete audio files for expired analyses.
 * Preserves results, matches, evidence, custody chain.
 */
export async function processExpiredAudioDeletion(): Promise<{
  deleted: number;
  failed: number;
  checked: number;
}> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: expired } = await supabase
    .from("analyses")
    .select("id, user_id, audio_url, normalized_audio_url, stems_urls, file_hash, mode")
    .lte("audio_expires_at", now)
    .is("audio_deleted_at", null)
    .limit(100);

  if (!expired || expired.length === 0) {
    return { deleted: 0, failed: 0, checked: 0 };
  }

  let deleted = 0;
  let failed = 0;

  for (const analysis of expired) {
    // Never auto-delete forensic
    if (analysis.mode === "forensic") continue;

    try {
      await deleteAnalysisAudioFiles(analysis.id, analysis.user_id, analysis, "policy_expiration");
      deleted++;
    } catch (err) {
      console.error(`Retention: failed to delete audio for ${analysis.id}:`, err);
      failed++;
    }
  }

  return { deleted, failed, checked: expired.length };
}

/**
 * Delete audio files for a single analysis.
 * Used by both scheduled job and user-initiated deletion.
 */
export async function deleteAnalysisAudioFiles(
  analysisId: string,
  userId: string,
  analysis: {
    audio_url: string | null;
    normalized_audio_url: string | null;
    stems_urls: Record<string, string> | null;
    file_hash: string | null;
  },
  reason: "policy_expiration" | "user_request" | "full_deletion" | "case_archived"
): Promise<void> {
  const supabase = createAdminClient();

  // Collect paths to delete
  const paths: string[] = [];

  if (analysis.audio_url) {
    const p = extractStoragePath(analysis.audio_url);
    if (p) paths.push(p);
  }

  if (analysis.normalized_audio_url) {
    const p = extractStoragePath(analysis.normalized_audio_url);
    if (p) paths.push(p);
  }

  if (analysis.stems_urls) {
    for (const url of Object.values(analysis.stems_urls)) {
      const p = extractStoragePath(url as string);
      if (p) paths.push(p);
    }
  }

  // Also try features JSON
  paths.push(`${userId}/${analysisId}/features/raw_features.json`);
  paths.push(`${userId}/${analysisId}/features/features.json`);

  // Delete from storage
  if (paths.length > 0) {
    await supabase.storage.from("probatio-audio").remove(paths);
  }

  // Update analysis
  await supabase
    .from("analyses")
    .update({
      audio_url: null,
      normalized_audio_url: null,
      stems_urls: null,
      audio_deleted_at: new Date().toISOString(),
    })
    .eq("id", analysisId);

  // Record custody
  await recordCustody({
    entityType: "analysis",
    entityId: analysisId,
    action: "file_deleted",
    actorId: reason === "policy_expiration" ? "system" : userId,
    artifactHash: analysis.file_hash ?? undefined,
    detail: {
      step_name: "data_retention",
      reason,
      files_deleted: paths.length,
      file_types: ["original_audio", "normalized_audio", "stems", "raw_features"],
      preserved: [
        "analysis results (scores, risk level)",
        "match evidence (timestamps, similarity)",
        "chain of custody (all entries)",
        "report narrative",
        "spectral signatures (embeddings)",
      ],
    },
  });
}
