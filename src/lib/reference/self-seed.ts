// @ts-nocheck — Supabase query types will be auto-generated
/**
 * PROBATIO — Reference Library Self-Seeding
 *
 * After an analysis completes, add the track to the reference library.
 * This builds the comparison corpus automatically — every track analyzed
 * makes future searches more powerful. This is the data moat.
 */

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Add a completed analysis to the reference_tracks table.
 * Uses the timbre (full mix) embedding from spectral_signatures.
 *
 * If an AcoustID-created record already exists for this track (matched by
 * file_hash or acoustid), we UPDATE it with the embedding rather than
 * creating a duplicate. This merges Layer 1 (AcoustID metadata) with
 * Layer 2 (self-seeded embeddings).
 *
 * Returns the reference_track id, or null if skipped (no analysis or error).
 */
export async function addToReferenceLibrary(
  analysisId: string,
  options: { visibility?: "public" | "private" } = {}
): Promise<string | null> {
  const { visibility = "public" } = options;
  const supabase = createAdminClient();

  // 1. Fetch the analysis
  const { data: analysis } = await supabase
    .from("analyses")
    .select("*")
    .eq("id", analysisId)
    .eq("status", "completed")
    .single();

  if (!analysis) return null;

  // FORENSIC ISOLATION: Never add forensic case tracks to any reference library.
  // Forensic audio is litigation material — as confidential as attorney-client privilege.
  if (analysis?.mode === 'forensic') {
    console.log("[PROBATIO] Skipping self-seed for forensic analysis (isolation required)");
    return null;
  }

  // 2. Fetch the timbre embedding (full mix)
  const { data: timbreSignature } = await supabase
    .from("spectral_signatures")
    .select("embedding")
    .eq("analysis_id", analysisId)
    .eq("dimension", "timbre")
    .single();

  // 3. Fetch the melody embedding (vocals)
  const { data: melodySignature } = await supabase
    .from("spectral_signatures")
    .select("embedding")
    .eq("analysis_id", analysisId)
    .eq("dimension", "melody")
    .single();

  // 4. Clean up the title (remove file extension)
  const title = (analysis.file_name || analysis.title || "Unknown")
    .replace(/\.[^/.]+$/, "")
    .replace(/_/g, " ");

  // 5. Get tempo and key from features if available
  const features = analysis.features as Record<string, unknown> | null;
  const tempo = features?.rhythm
    ? (features.rhythm as Record<string, unknown>)?.estimatedTempoBpm as number
    : null;
  const key = features?.key
    ? (features.key as Record<string, unknown>)?.key as string
    : null;

  // 6. Check if a reference_track already exists (by file_hash or acoustid)
  //    This covers both self-seeded duplicates AND AcoustID-created records.
  const { data: existingByHash } = await supabase
    .from("reference_tracks")
    .select("id, source")
    .eq("fingerprint", analysis.file_hash)
    .limit(1)
    .single();

  // Also check by acoustid if the analysis has one
  const analysisAcoustid = (analysis as Record<string, unknown>).acoustid as string | undefined;
  let existingByAcoustid = null;
  if (!existingByHash && analysisAcoustid) {
    const { data } = await supabase
      .from("reference_tracks")
      .select("id, source")
      .eq("acoustid", analysisAcoustid)
      .limit(1)
      .single();
    existingByAcoustid = data;
  }

  const existingRecord = existingByHash ?? existingByAcoustid;

  if (existingRecord) {
    // UPDATE existing record with embedding data (merges Layer 1 + Layer 2)
    const { error } = await supabase
      .from("reference_tracks")
      .update({
        title: title || undefined,
        embedding: timbreSignature?.embedding ?? null,
        embedding_vocals: melodySignature?.embedding ?? null,
        duration_sec: analysis.file_duration_sec,
        tempo_bpm: tempo,
        key_signature: key,
        audio_url: analysis.audio_url,
        visibility,
        contributed_by: analysis.user_id,
      })
      .eq("id", existingRecord.id);

    if (error) {
      console.error("[PROBATIO] Failed to update reference track:", error.message);
      return null;
    }

    return existingRecord.id;
  }

  // 7. No existing record — insert new reference track
  const { data: refTrack, error } = await supabase
    .from("reference_tracks")
    .insert({
      title,
      artist: "Unknown",  // Will be enriched via AcoustID/MusicBrainz later
      duration_sec: analysis.file_duration_sec,
      tempo_bpm: tempo,
      key_signature: key,
      embedding: timbreSignature?.embedding ?? null,
      embedding_vocals: melodySignature?.embedding ?? null,
      source: "self_seed",
      fingerprinted: false,
      audio_url: analysis.audio_url,
      visibility,
      contributed_by: analysis.user_id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[PROBATIO] Failed to self-seed reference track:", error.message);
    return null;
  }

  return refTrack?.id ?? null;
}
