// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — AcoustID Fingerprint Lookup
 *
 * Generates a Chromaprint fingerprint and looks up AcoustID matches.
 * Since Chromaprint (fpcalc) requires native C binaries not available
 * in Vercel's Node runtime, this delegates to the Modal.com fingerprint
 * function where fpcalc runs on Modal infrastructure.
 */

import { callModalEndpoint } from "@/lib/modal/client";
import { MODAL_ENDPOINTS } from "@/lib/modal/endpoints";
import type {
  FingerprintRequest,
  FingerprintResponse,
  AcoustIDMatch,
} from "@/lib/modal/endpoints";

export interface FingerprintResult {
  fingerprint: string;
  fingerprintHash: string;
  durationSec: number;
  acoustidMatches: AcoustIDMatch[];
  lookupTimeMs: number;
}

/**
 * Generate a Chromaprint fingerprint and look up AcoustID matches.
 * Delegates to the Modal.com fingerprint function (fpcalc runs on Modal).
 *
 * @param fileUrl  Public URL of the audio file to fingerprint.
 * @param fileHash SHA-256 hash of the original file (used for caching/dedup).
 * @returns        Fingerprint data and any AcoustID matches found.
 */
export async function fingerprintAndLookup(
  fileUrl: string,
  fileHash: string,
): Promise<FingerprintResult> {
  const result = await callModalEndpoint<FingerprintRequest, FingerprintResponse>(
    MODAL_ENDPOINTS.fingerprint,
    { fileUrl, fileHash },
    { timeoutMs: 120_000 },
  );

  return {
    fingerprint: result.fingerprint,
    fingerprintHash: result.fingerprintHash,
    durationSec: result.durationSec,
    acoustidMatches: result.acoustidMatches,
    lookupTimeMs: result.lookupTimeMs,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Reference Library Enrichment (Layer 1 — AcoustID metadata)
// ────────────────────────────────────────────────────────────────────────────

import { createAdminClient } from "@/lib/supabase/admin";

export interface AcoustIDEnrichedMatch {
  referenceTrackId: string;
  title: string;
  artist: string;
  matchScore: number;
  source: "acoustid";
  hasEmbedding: boolean;
  hasRightsInfo: boolean;
  isrc: string | null;
  musicbrainzId: string | null;
}

export interface EnrichmentResult {
  tracksCreated: number;
  tracksUpdated: number;
  tracksEnrichedWithRights: number;
  matches: AcoustIDEnrichedMatch[];
}

/**
 * Enrich the reference library from AcoustID fingerprint matches.
 * For each match, creates or updates a reference_track with metadata.
 * This is Layer 1 of the two-layer strategy.
 */
export async function enrichReferenceLibrary(
  acoustidMatches: AcoustIDMatch[]
): Promise<EnrichmentResult> {
  const supabase = createAdminClient();
  const result: EnrichmentResult = {
    tracksCreated: 0,
    tracksUpdated: 0,
    tracksEnrichedWithRights: 0,
    matches: [],
  };

  for (const match of acoustidMatches) {
    if (!match.acoustidId) continue;

    // Check if reference_track with this acoustid already exists
    const { data: existing } = await supabase
      .from("reference_tracks")
      .select("id, embedding, title, artist")
      .eq("acoustid", match.acoustidId)
      .limit(1)
      .single();

    // Extract best recording info from AcoustID match
    const recording = match.recordings?.[0];
    const title = recording?.title ?? "Unknown Track";
    const artist = recording?.artists?.[0]?.name ?? "Unknown Artist";
    const isrc = null; // AcoustID doesn't always provide ISRC
    const musicbrainzId = recording?.id ?? null;

    let refTrackId: string;
    let hasEmbedding = false;

    if (existing) {
      // Update existing record with any new metadata
      refTrackId = existing.id;
      hasEmbedding = !!existing.embedding;

      // Only update if we have better data
      if (musicbrainzId && !existing.title.includes(title)) {
        await supabase
          .from("reference_tracks")
          .update({
            title: title || existing.title,
            artist: artist || existing.artist,
            musicbrainz_id: musicbrainzId,
            fingerprinted: true,
          })
          .eq("id", existing.id);
      }
      result.tracksUpdated++;
    } else {
      // Create new reference track (metadata only, no embedding yet)
      const { data: newTrack } = await supabase
        .from("reference_tracks")
        .insert({
          title,
          artist,
          acoustid: match.acoustidId,
          musicbrainz_id: musicbrainzId,
          isrc,
          source: "acoustid",
          visibility: "public",
          fingerprinted: true,
        })
        .select("id")
        .single();

      refTrackId = newTrack?.id ?? "";
      result.tracksCreated++;
    }

    // Try MusicBrainz enrichment for rights info
    let hasRightsInfo = false;
    if (musicbrainzId) {
      try {
        const { enrichMatchRights } = await import("@/lib/musicbrainz");
        const rights = await enrichMatchRights(musicbrainzId, isrc);
        if (rights) {
          await supabase
            .from("reference_tracks")
            .update({
              publisher: rights.publishers?.[0]?.name ?? null,
              composer: rights.composers?.[0]?.name ?? null,
            })
            .eq("id", refTrackId);
          hasRightsInfo = true;
          result.tracksEnrichedWithRights++;
        }
      } catch {
        // MusicBrainz lookup failed — non-fatal
      }
    }

    result.matches.push({
      referenceTrackId: refTrackId,
      title,
      artist,
      matchScore: match.score,
      source: "acoustid",
      hasEmbedding,
      hasRightsInfo,
      isrc,
      musicbrainzId,
    });

    // Rate limit for MusicBrainz
    await new Promise((r) => setTimeout(r, 1100));
  }

  return result;
}
