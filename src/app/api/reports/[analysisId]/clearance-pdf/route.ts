// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Clearance Report PDF Endpoint
 *
 * GET /api/reports/[analysisId]/clearance-pdf
 * Generates and returns a pre-release clearance report PDF.
 * Only available for analyses in clearance mode.
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
import { recordCustody } from "@/lib/custody";
import { formatDate } from "@/lib/utils";

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> },
) {
  try {
    const { analysisId } = await params;
    const supabase = await createClient();
    const admin = createAdminClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch analysis (ownership check)
    const { data: analysis } = await admin
      .from("analyses")
      .select("*")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .single();

    if (!analysis) {
      return NextResponse.json(
        { error: "Analysis not found" },
        { status: 404 },
      );
    }

    if (analysis.mode !== "clearance") {
      return NextResponse.json(
        { error: "This endpoint is only for clearance analyses" },
        { status: 400 },
      );
    }

    if (analysis.status !== "completed") {
      return NextResponse.json(
        { error: "Analysis is not yet completed" },
        { status: 400 },
      );
    }

    // Fetch matches with reference track details
    const { data: matches } = await admin
      .from("analysis_matches")
      .select("*")
      .eq("analysis_id", analysisId)
      .order("score_overall", { ascending: false });

    // Enrich matches with reference track + evidence data
    const enrichedMatches: ClearancePDFData["matches"] = [];
    for (const [i, match] of (matches ?? []).entries()) {
      let refTitle = "Unknown Track";
      let refArtist = "Unknown Artist";
      let refIsrc: string | null = null;
      let refYear: number | null = null;
      let catalogName: string | null = null;

      if (match.reference_track_id) {
        const { data: ref } = await admin
          .from("reference_tracks")
          .select("title, artist, isrc, release_year, catalog_id")
          .eq("id", match.reference_track_id)
          .single();

        if (ref) {
          refTitle = ref.title;
          refArtist = ref.artist;
          refIsrc = ref.isrc;
          refYear = ref.release_year;

          if (ref.catalog_id) {
            const { data: cat } = await admin
              .from("enterprise_catalogs")
              .select("name")
              .eq("id", ref.catalog_id)
              .single();
            catalogName = cat?.name ?? null;
          }
        }
      }

      // Fetch evidence
      const { data: evidence } = await admin
        .from("match_evidence")
        .select("*")
        .eq("match_id", match.id)
        .order("similarity_score", { ascending: false })
        .limit(5);

      enrichedMatches.push({
        rank: i + 1,
        referenceTitle: refTitle,
        referenceArtist: refArtist,
        isrc: refIsrc,
        releaseYear: refYear,
        catalogName,
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
        finding: `Overall similarity of ${Math.round((match.score_overall ?? 0) * 100)}%` +
          (match.score_overall_adjusted != null
            ? ` (${Math.round(match.score_overall_adjusted * 100)}% genre-adjusted)`
            : "") +
          `. Risk level: ${match.risk_level}.`,
        recommendation:
          (match.score_overall ?? 0) >= 0.60
            ? "Obtain clearance or modify the matching sections before release."
            : (match.score_overall ?? 0) >= 0.30
              ? "Review with legal counsel. Consider modification of flagged sections."
              : "No action required for this match.",
        evidence: (evidence ?? []).map((ev) => ({
          sourceTime: `${formatTime(ev.source_start_sec)}-${formatTime(ev.source_end_sec)}`,
          targetTime: `${formatTime(ev.target_start_sec)}-${formatTime(ev.target_end_sec)}`,
          dimension: ev.dimension,
          similarity: ev.similarity_score,
          detail:
            ev.detail?.transposition_semitones != null &&
            ev.detail.transposition_semitones !== 0
              ? `+${ev.detail.transposition_semitones} st`
              : ev.description?.slice(0, 30) ?? "",
        })),
      });
    }

    // Fetch catalog info
    const catalogIds = analysis.catalog_ids ?? [];
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

    // Extract features for genre/tempo/key
    const features = analysis.features as Record<string, unknown> | null;
    const tempo =
      (features?.rhythm as Record<string, unknown>)
        ?.estimatedTempoBpm as number | null ?? null;
    const key =
      (features?.key as Record<string, unknown>)?.key as string | null ??
      null;

    // Generate clearance narrative
    const narrative = await generateClearanceNarrative({
      fileName: analysis.file_name,
      durationSec: analysis.duration_seconds ?? 0,
      clearanceStatus: analysis.clearance_status ?? "cleared",
      detectedGenre: analysis.detected_genre,
      genreConfidence: analysis.genre_confidence,
      overallScore: analysis.overall_score ?? 0,
      matchCount: enrichedMatches.length,
      catalogNames: catalogs.map((c) => c.name),
      totalTracksScanned,
      pipelineVersion: analysis.pipeline_version ?? "1.0.0",
      matches: enrichedMatches.map((m) => ({
        title: m.referenceTitle,
        artist: m.referenceArtist,
        scoreOverall: m.scoreOverall,
        scoreOverallAdjusted: m.scoreOverallAdjusted,
        scoreMelody: m.scoreMelody,
        riskLevel: m.riskLevel,
        topEvidence: m.evidence.map(
          (e) => `${e.dimension} ${Math.round(e.similarity * 100)}% at ${e.sourceTime}`,
        ),
      })),
    });

    // Build PDF data
    const pdfData: ClearancePDFData = {
      analysisId,
      fileName: analysis.file_name,
      fileHash: analysis.file_hash,
      durationSec: analysis.duration_seconds ?? 0,
      tempoBpm: tempo,
      key,
      detectedGenre: analysis.detected_genre,
      genreConfidence: analysis.genre_confidence,
      clearanceStatus: (analysis.clearance_status ?? "cleared") as
        | "cleared"
        | "conditional"
        | "blocked",
      overallScore: analysis.overall_score ?? 0,
      pipelineVersion: analysis.pipeline_version ?? "1.0.0",
      analyzedAt: formatDate(analysis.created_at),
      catalogs,
      totalTracksScanned,
      narrative,
      matches: enrichedMatches,
    };

    // Generate PDF
    const pdfBuffer = await generateClearancePDFBuffer(pdfData);

    // Record custody
    await recordCustody({
      entityType: "analysis",
      entityId: analysisId,
      action: "clearance_report_exported",
      actorId: user.id,
      artifactType: "clearance_pdf",
      detail: {
        clearance_status: analysis.clearance_status,
        match_count: enrichedMatches.length,
      },
    });

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="probatio-clearance-${analysisId.slice(0, 8)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[GET /api/reports/:id/clearance-pdf]", error);
    return NextResponse.json(
      { error: "Failed to generate clearance report" },
      { status: 500 },
    );
  }
}
