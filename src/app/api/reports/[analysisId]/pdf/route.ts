// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — PDF Report Download
 *
 * GET /api/reports/[analysisId]/pdf
 *
 * Generates a forensic-grade PDF report using @react-pdf/renderer.
 * Auth required. Only the analysis owner can download.
 * Records a chain_of_custody entry on each download.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePDFBuffer } from "@/lib/report/pdf-generator";
import type { PDFReportData } from "@/lib/report/pdf-generator";
import { rateLimit } from "@/lib/rate-limit";
import { generateQRCodeDataUrl, buildVerificationUrl } from "@/lib/report/qr-code";
import { signBuffer, isSigningAvailable, sha256Hex } from "@/lib/crypto/signing";
import { renderHeatmapPng } from "@/lib/report/render-heatmap";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  try {
    const { analysisId } = await params;
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success: rateLimitOk, resetIn } = rateLimit(`pdf:${user.id}`, 10, 60_000);
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(resetIn / 1000)) } }
      );
    }

    // Fetch analysis with ownership check
    const { data: analysis } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .single();

    if (!analysis) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    }

    if (analysis.status !== "completed") {
      return NextResponse.json({ error: "Analysis not yet completed" }, { status: 400 });
    }

    // Fetch matches
    const { data: matches } = await adminClient
      .from("analysis_matches")
      .select("*")
      .eq("analysis_id", analysisId)
      .order("score_overall", { ascending: false });

    // Fetch evidence for each match
    const matchesWithEvidence = [];
    for (const match of matches ?? []) {
      const { data: evidence } = await adminClient
        .from("match_evidence")
        .select("*")
        .eq("match_id", match.id)
        .order("similarity_score", { ascending: false });

      // Get reference track
      let refTitle = "Unknown Track";
      let refArtist = "Unknown Artist";
      if (match.reference_track_id) {
        const { data: ref } = await adminClient
          .from("reference_tracks")
          .select("title, artist")
          .eq("id", match.reference_track_id)
          .single();
        if (ref) { refTitle = ref.title; refArtist = ref.artist; }
      }

      matchesWithEvidence.push({
        id: match.id,
        referenceTitle: refTitle,
        referenceArtist: refArtist,
        scoreOverall: match.score_overall ?? 0,
        scoreMelody: match.score_melody,
        scoreHarmony: match.score_harmony,
        scoreRhythm: match.score_rhythm,
        scoreTimbre: match.score_timbre,
        scoreLyrics: match.score_lyrics,
        riskLevel: match.risk_level ?? "low",
        rightsHolders: match.rights_holders,
        evidence: (evidence ?? []).map((e) => ({
          dimension: e.dimension,
          similarity: e.similarity_score,
          sourceStart: e.source_start_sec,
          sourceEnd: e.source_end_sec,
          targetStart: e.target_start_sec,
          targetEnd: e.target_end_sec,
          description: e.description ?? "",
          transposition: e.detail?.transposition_name as string ?? null,
          resolution: e.resolution ?? "phrase",
        })),
      });
    }

    // Fetch report from storage or use narrative
    let reportData = {
      executiveSummary: analysis.report_narrative?.split("\n\n")[0] ?? "No executive summary available.",
      methodology: "Analysis performed using Probatio forensic audio intelligence platform.",
      riskAssessment: `Overall risk: ${analysis.overall_risk?.toUpperCase() ?? "LOW"}`,
      recommendations: "See individual match analysis for specific recommendations.",
      limitations: "This analysis does not constitute legal advice. Similarity scores are statistical measures. Consult qualified counsel.",
      matchAnalyses: [] as Array<{ matchId: string; title: string; artist: string; overallSimilarity: number; riskLevel: string; narrative: string; keyEvidence: string[]; recommendation: string }>,
    };

    // Try to load full report from storage
    try {
      const reportPath = `${user.id}/${analysisId}/report/report.json`;
      const { data: reportFile } = await adminClient.storage
        .from("probatio-audio")
        .download(reportPath);
      if (reportFile) {
        const text = await reportFile.text();
        const parsed = JSON.parse(text);
        reportData = parsed;
      }
    } catch { /* Use fallback */ }

    // Fetch chain of custody
    const { data: custody } = await adminClient
      .from("chain_of_custody")
      .select("sequence_num, action, entry_hash, artifact_hash, recorded_at")
      .eq("entity_type", "analysis")
      .eq("entity_id", analysisId)
      .order("sequence_num", { ascending: true });

    // Get features for tempo/key
    const features = analysis.features as Record<string, unknown> | null;

    // Fetch expert annotations (if any)
    const { data: annotations } = await adminClient
      .from("expert_annotations")
      .select("annotator_id, annotation_text, created_at")
      .eq("analysis_id", analysisId)
      .order("created_at");

    // Generate QR code for verification
    let qrCodeDataUrl: string | null = null;
    try {
      qrCodeDataUrl = await generateQRCodeDataUrl(
        buildVerificationUrl(analysis.file_hash ?? ""),
      );
    } catch { /* QR generation failure is non-fatal */ }

    // Build dimension scores with adjusted values from top match
    const topMatch = matchesWithEvidence[0];
    const topMatchRow = matches?.[0];
    const dimensionScores = topMatch ? {
      melody: { raw: topMatch.scoreMelody ?? 0, adjusted: topMatchRow?.score_melody_adjusted ?? null, baseline: null },
      harmony: { raw: topMatch.scoreHarmony ?? 0, adjusted: topMatchRow?.score_harmony_adjusted ?? null, baseline: null },
      rhythm: { raw: topMatch.scoreRhythm ?? 0, adjusted: topMatchRow?.score_rhythm_adjusted ?? null, baseline: null },
      timbre: { raw: topMatch.scoreTimbre ?? 0, adjusted: topMatchRow?.score_timbre_adjusted ?? null, baseline: null },
      lyrics: { raw: topMatch.scoreLyrics ?? 0, adjusted: topMatchRow?.score_lyrics_adjusted ?? null, baseline: null },
    } : null;

    // Generate heatmap PNGs for PDF embedding
    const allEvidence = matchesWithEvidence.flatMap((m) => m.evidence.map((e) => ({
      source_start_sec: e.sourceStart,
      source_end_sec: e.sourceEnd,
      target_start_sec: e.targetStart,
      target_end_sec: e.targetEnd,
      similarity_score: e.similarity,
      dimension: e.dimension.toLowerCase(),
    })));

    let heatmapImages: Record<string, string> | null = null;
    if (allEvidence.length > 0) {
      try {
        const srcDur = analysis.duration_seconds ?? 210;
        const tgtDur = 210; // target duration estimate
        const renderOpts = { sourceDuration: srcDur, targetDuration: tgtDur, width: 600, height: 380 };

        const [hAll, hMel, hHar, hRhy, hTim, hLyr] = await Promise.all([
          renderHeatmapPng({ evidence: allEvidence, ...renderOpts, title: "All Dimensions" }),
          renderHeatmapPng({ evidence: allEvidence, ...renderOpts, dimension: "melody", title: "Melody Similarity" }),
          renderHeatmapPng({ evidence: allEvidence, ...renderOpts, dimension: "harmony", title: "Harmony Similarity" }),
          renderHeatmapPng({ evidence: allEvidence, ...renderOpts, dimension: "rhythm", title: "Rhythm Similarity" }),
          renderHeatmapPng({ evidence: allEvidence, ...renderOpts, dimension: "timbre", title: "Timbre Similarity" }),
          renderHeatmapPng({ evidence: allEvidence, ...renderOpts, dimension: "lyrics", title: "Lyrics Similarity" }),
        ]);

        const toDataUrl = (buf: Buffer) => `data:image/png;base64,${buf.toString("base64")}`;
        heatmapImages = {
          all: toDataUrl(hAll),
          melody: toDataUrl(hMel),
          harmony: toDataUrl(hHar),
          rhythm: toDataUrl(hRhy),
          timbre: toDataUrl(hTim),
          lyrics: toDataUrl(hLyr),
        };
      } catch (heatmapErr) {
        console.error("Heatmap generation failed (non-fatal):", heatmapErr);
      }
    }

    // Build PDF data
    const pdfData: PDFReportData = {
      analysisId,
      fileName: analysis.file_name ?? "Unknown",
      fileHash: analysis.file_hash ?? "",
      durationSec: analysis.duration_seconds ?? 0,
      tempoBpm: (features?.rhythm as Record<string, unknown>)?.estimatedTempoBpm as number ?? null,
      key: (features?.key as Record<string, unknown>)?.key as string ?? null,
      overallRisk: analysis.overall_risk ?? "low",
      overallScore: analysis.overall_score ?? 0,
      pipelineVersion: analysis.pipeline_version ?? "v1.0.0",
      analyzedAt: analysis.completed_at ?? analysis.created_at,
      detectedGenre: analysis.detected_genre,
      genreConfidence: analysis.genre_confidence,
      overallAdjusted: topMatchRow?.score_overall_adjusted ?? null,
      qrCodeDataUrl,
      dimensionScores,
      expertAnnotations: (annotations ?? []).map((a) => ({
        author: a.annotator_id ?? "Expert",
        date: new Date(a.created_at).toLocaleDateString("en-US"),
        note: a.annotation_text,
      })),
      pipelineModels: {
        "Demucs": "htdemucs_ft v4.0.1",
        "CREPE": "full capacity v0.0.16",
        "CLAP": "laion/larger_clap_music_and_speech",
        "Whisper": "large-v3 (openai-whisper 20240930)",
        "Embedding": "all-MiniLM-L6-v2 (384→512)",
        "DTW": "custom with transposition detection",
        "librosa": "0.10.1",
      },
      heatmapImages,
      report: reportData,
      matches: matchesWithEvidence,
      custodyChain: (custody ?? []).map((c) => ({
        sequenceNum: c.sequence_num,
        action: c.action,
        entryHash: c.entry_hash ?? "",
        artifactHash: c.artifact_hash,
        recordedAt: c.recorded_at,
      })),
      finalHash: analysis.final_hash ?? null,
    };

    // Generate PDF
    const pdfBuffer = await generatePDFBuffer(pdfData);

    // Sign the PDF buffer if signing keys are configured
    const responseHeaders: Record<string, string> = {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="probatio-report-${analysisId.slice(0, 8)}.pdf"`,
      "Cache-Control": "no-store",
    };

    let signatureData: { signature: string; signed_hash: string } | null = null;
    if (isSigningAvailable()) {
      const sig = signBuffer(pdfBuffer);
      responseHeaders["X-Probatio-Signature"] = sig.signature;
      responseHeaders["X-Probatio-Signed-Hash"] = sig.signed_hash;
      responseHeaders["X-Probatio-Signature-Algorithm"] = sig.algorithm;
      signatureData = { signature: sig.signature, signed_hash: sig.signed_hash };
    }

    // Record custody: report_exported (with signature if available)
    await adminClient.from("chain_of_custody").insert({
      entity_type: "analysis",
      entity_id: analysisId,
      action: "report_exported",
      actor_id: user.id,
      artifact_type: "pdf_report",
      detail: {
        export_format: "pdf",
        exported_at: new Date().toISOString(),
        document_hash: sha256Hex(pdfBuffer),
        ...(signatureData ? { ed25519_signature: signatureData.signature } : {}),
      },
      recorded_at: new Date().toISOString(),
    });

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF report" },
      { status: 500 }
    );
  }
}
