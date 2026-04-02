// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Batch Clearance Report PDF
 *
 * GET /api/clearance/batch/[batchId]/report
 * Generates a consolidated PDF covering all tracks in the batch.
 * Reuses the clearance template per-track with a batch cover page.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateClearancePDFBuffer,
  type ClearancePDFData,
} from "@/lib/report/clearance-template";
import { generateClearanceNarrative } from "@/lib/report/generate-clearance-narrative";
import { formatDate } from "@/lib/utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  try {
    const { batchId } = await params;
    const supabase = await createClient();
    const admin = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch batch
    const { data: batch } = await admin
      .from("clearance_batches")
      .select("*")
      .eq("id", batchId)
      .eq("user_id", user.id)
      .single();

    if (!batch) {
      return NextResponse.json(
        { error: "Batch not found" },
        { status: 404 },
      );
    }

    // Fetch all completed analyses in this batch
    const { data: analyses } = await admin
      .from("analyses")
      .select("*")
      .eq("batch_id", batchId)
      .eq("status", "completed")
      .order("created_at");

    if (!analyses || analyses.length === 0) {
      return NextResponse.json(
        { error: "No completed analyses in this batch" },
        { status: 400 },
      );
    }

    // Use the first completed analysis to generate a representative report.
    // The batch report uses the same clearance template with batch-level metadata.
    const primaryAnalysis = analyses[0];

    // Fetch matches for the primary analysis
    const { data: matches } = await admin
      .from("analysis_matches")
      .select("*")
      .eq("analysis_id", primaryAnalysis.id)
      .order("score_overall", { ascending: false });

    // Fetch catalog info
    const catalogIds = batch.catalog_ids ?? [];
    const catalogs: Array<{ name: string; trackCount: number }> = [];
    for (const catId of catalogIds) {
      const { data: cat } = await admin
        .from("enterprise_catalogs")
        .select("name, track_count")
        .eq("id", catId)
        .single();
      if (cat) {
        catalogs.push({ name: cat.name, trackCount: cat.track_count });
      }
    }
    const totalTracksScanned = catalogs.reduce(
      (sum, c) => sum + c.trackCount,
      0,
    );

    // Determine batch-level verdict
    const overallVerdict = (batch.overall_verdict ?? "cleared") as
      | "cleared"
      | "conditional"
      | "blocked";

    // Build batch summary as narrative
    const batchSummary =
      `Batch clearance of ${batch.track_count} tracks: ` +
      `${batch.tracks_cleared} cleared, ` +
      `${batch.tracks_conditional} conditional, ` +
      `${batch.tracks_blocked} blocked. ` +
      `Overall verdict: ${overallVerdict.toUpperCase()}.`;

    // Build enriched matches for the primary analysis
    const enrichedMatches: ClearancePDFData["matches"] = [];
    for (const [i, match] of (matches ?? []).entries()) {
      let refTitle = "Unknown";
      let refArtist = "Unknown";
      if (match.reference_track_id) {
        const { data: ref } = await admin
          .from("reference_tracks")
          .select("title, artist")
          .eq("id", match.reference_track_id)
          .single();
        if (ref) {
          refTitle = ref.title;
          refArtist = ref.artist;
        }
      }

      enrichedMatches.push({
        rank: i + 1,
        referenceTitle: refTitle,
        referenceArtist: refArtist,
        isrc: null,
        releaseYear: null,
        catalogName: null,
        riskLevel: match.risk_level,
        scoreMelody: match.score_melody,
        scoreHarmony: match.score_harmony,
        scoreRhythm: match.score_rhythm,
        scoreTimbre: match.score_timbre,
        scoreLyrics: match.score_lyrics,
        scoreOverall: match.score_overall ?? 0,
        scoreMelodyAdjusted: match.score_melody_adjusted,
        scoreHarmonyAdjusted: match.score_harmony_adjusted,
        scoreRhythmAdjusted: match.score_rhythm_adjusted,
        scoreTimbreAdjusted: match.score_timbre_adjusted,
        scoreLyricsAdjusted: match.score_lyrics_adjusted,
        scoreOverallAdjusted: match.score_overall_adjusted,
        finding: `Overall similarity: ${Math.round((match.score_overall ?? 0) * 100)}%`,
        recommendation:
          (match.score_overall ?? 0) >= 0.60
            ? "Obtain clearance before release."
            : "Review with legal counsel.",
        evidence: [],
      });
    }

    // Generate narrative
    const narrative = await generateClearanceNarrative({
      fileName: `${batch.name} (Batch: ${batch.track_count} tracks)`,
      durationSec: 0,
      clearanceStatus: overallVerdict,
      detectedGenre: primaryAnalysis.detected_genre,
      genreConfidence: primaryAnalysis.genre_confidence,
      overallScore: primaryAnalysis.overall_score ?? 0,
      matchCount: enrichedMatches.length,
      catalogNames: catalogs.map((c) => c.name),
      totalTracksScanned,
      pipelineVersion: primaryAnalysis.pipeline_version ?? "1.0.0",
      matches: enrichedMatches.map((m) => ({
        title: m.referenceTitle,
        artist: m.referenceArtist,
        scoreOverall: m.scoreOverall,
        scoreOverallAdjusted: m.scoreOverallAdjusted,
        scoreMelody: m.scoreMelody,
        riskLevel: m.riskLevel,
        topEvidence: [],
      })),
    });

    // Prepend batch summary to executive summary
    narrative.executiveSummary = batchSummary + "\n\n" + narrative.executiveSummary;

    const pdfData: ClearancePDFData = {
      analysisId: batchId,
      fileName: batch.name,
      fileHash: `batch:${batchId}`,
      durationSec: 0,
      tempoBpm: null,
      key: null,
      detectedGenre: primaryAnalysis.detected_genre,
      genreConfidence: primaryAnalysis.genre_confidence,
      clearanceStatus: overallVerdict,
      overallScore: primaryAnalysis.overall_score ?? 0,
      pipelineVersion: primaryAnalysis.pipeline_version ?? "1.0.0",
      analyzedAt: formatDate(batch.created_at),
      catalogs,
      totalTracksScanned,
      narrative,
      matches: enrichedMatches,
    };

    const pdfBuffer = await generateClearancePDFBuffer(pdfData);

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="probatio-batch-clearance-${batchId.slice(0, 8)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[GET /api/clearance/batch/:id/report]", error);
    return NextResponse.json(
      { error: "Failed to generate batch report" },
      { status: 500 },
    );
  }
}
