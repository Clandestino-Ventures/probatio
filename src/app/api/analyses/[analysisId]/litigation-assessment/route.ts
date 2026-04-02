// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Litigation Assessment API
 *
 * POST /api/analyses/[analysisId]/litigation-assessment — Regenerate assessment.
 * GET  /api/analyses/[analysisId]/litigation-assessment — Fetch stored assessment.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ analysisId: string }> },
) {
  try {
    const { analysisId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: analysis, error } = await supabase
      .from("analyses")
      .select("litigation_assessment")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .single();

    if (error || !analysis) {
      return NextResponse.json(
        { error: "Analysis not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      assessment: analysis.litigation_assessment,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ analysisId: string }> },
) {
  try {
    const { analysisId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const { data: analysis, error: fetchError } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !analysis) {
      return NextResponse.json(
        { error: "Analysis not found" },
        { status: 404 },
      );
    }

    const admin = createAdminClient();

    // Fetch top match with reference track
    const { data: matches } = await admin
      .from("analysis_matches")
      .select("*, reference_tracks(title, artist, isrc, release_year, duration_seconds, genre)")
      .eq("analysis_id", analysisId)
      .order("score_overall", { ascending: false })
      .limit(1);

    if (!matches || matches.length === 0) {
      return NextResponse.json(
        { error: "No matches found for assessment" },
        { status: 400 },
      );
    }

    const topMatch = matches[0];
    const ref = topMatch.reference_tracks;

    // Fetch evidence
    const { data: evidence } = await admin
      .from("match_evidence")
      .select("*")
      .eq("match_id", topMatch.id)
      .order("similarity_score", { ascending: false })
      .limit(15);

    // Compute transposition data
    const melodyEvidence = (evidence ?? []).filter(
      (e) => e.dimension === "melody"
    );
    const transpositions = melodyEvidence
      .map((e) => e.detail?.transposition_semitones)
      .filter((t): t is number => t != null);
    const primaryTransposition =
      transpositions.length > 0
        ? transpositions.sort(
            (a, b) =>
              transpositions.filter((v) => v === b).length -
              transpositions.filter((v) => v === a).length
          )[0] ?? null
        : null;
    const transpositionConsistency =
      transpositions.length > 0 && primaryTransposition != null
        ? transpositions.filter((t) => t === primaryTransposition).length /
          transpositions.length
        : 0;

    const refReleaseYear = ref?.release_year;
    const releaseGapDays =
      refReleaseYear != null
        ? Math.round(
            (new Date(analysis.created_at).getTime() -
              new Date(`${refReleaseYear}-01-01`).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null;

    const formatTimeSec = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${s.toString().padStart(2, "0")}`;
    };

    const { generateLitigationAssessment } = await import(
      "@/lib/report/litigation-assessment"
    );

    const assessment = await generateLitigationAssessment({
      analysisId,
      mode: analysis.mode ?? "screening",
      trackA: {
        title: analysis.file_name ?? "Unknown",
        artist: "Analyzed Track",
        releaseDate: null,
        isrc: null,
        duration: analysis.duration_seconds ?? 0,
      },
      trackB: {
        title: ref?.title ?? "Reference Track",
        artist: ref?.artist ?? "Unknown Artist",
        releaseDate: refReleaseYear ? `${refReleaseYear}` : null,
        isrc: ref?.isrc ?? null,
        duration: ref?.duration_seconds ?? 0,
      },
      dimensionScores: {
        melody: topMatch.score_melody != null ? {
          raw: topMatch.score_melody,
          adjusted: topMatch.score_melody_adjusted ?? topMatch.score_melody,
          baseline: 0.25,
        } : null,
        harmony: topMatch.score_harmony != null ? {
          raw: topMatch.score_harmony,
          adjusted: topMatch.score_harmony_adjusted ?? topMatch.score_harmony,
          baseline: 0.25,
        } : null,
        rhythm: topMatch.score_rhythm != null ? {
          raw: topMatch.score_rhythm,
          adjusted: topMatch.score_rhythm_adjusted ?? topMatch.score_rhythm,
          baseline: 0.25,
        } : null,
        timbre: topMatch.score_timbre != null ? {
          raw: topMatch.score_timbre,
          adjusted: topMatch.score_timbre_adjusted ?? topMatch.score_timbre,
          baseline: 0.25,
        } : null,
        lyrics: topMatch.score_lyrics != null ? {
          raw: topMatch.score_lyrics,
          adjusted: topMatch.score_lyrics_adjusted ?? topMatch.score_lyrics,
          baseline: 0.15,
        } : null,
      },
      overallRaw: topMatch.score_overall ?? 0,
      overallAdjusted: topMatch.score_overall_adjusted ?? topMatch.score_overall ?? 0,
      riskLevel: topMatch.risk_level ?? "low",
      detectedGenre: analysis.detected_genre ?? "pop",
      genreConfidence: analysis.genre_confidence ?? 0.5,
      topEvidence: (evidence ?? []).map((e) => ({
        dimension: e.dimension,
        similarity: e.similarity_score,
        sourceTime: formatTimeSec(e.source_start_sec),
        targetTime: formatTimeSec(e.target_start_sec),
        transposition: e.detail?.transposition_semitones,
        resolution: e.resolution ?? "phrase",
      })),
      totalEvidencePoints: (evidence ?? []).length,
      primaryTransposition,
      transpositionConsistency,
      releaseGapDays,
    });

    // Store updated assessment
    await admin
      .from("analyses")
      .update({ litigation_assessment: assessment })
      .eq("id", analysisId);

    return NextResponse.json({ assessment });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
