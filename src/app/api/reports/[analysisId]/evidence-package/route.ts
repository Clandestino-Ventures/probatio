// @ts-nocheck — Supabase query types will be auto-generated
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePDFBuffer } from "@/lib/report/pdf-generator";
import type { PDFReportData } from "@/lib/report/pdf-generator";
import archiver from "archiver";
import { Readable } from "stream";
import { rateLimit } from "@/lib/rate-limit";
import { signBuffer, isSigningAvailable, sha256Hex } from "@/lib/crypto/signing";

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

    const { success: rateLimitOk, resetIn } = rateLimit(`evidence-package:${user.id}`, 10, 60_000);
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(resetIn / 1000)) } }
      );
    }

    // Fetch analysis
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
      return NextResponse.json({ error: "Analysis not completed" }, { status: 400 });
    }

    // Plan check — professional+ only
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan_tier")
      .eq("id", user.id)
      .single();

    const tier = profile?.plan_tier ?? "free";
    if (tier === "free" || tier === "starter") {
      return NextResponse.json(
        { error: "Evidence package export requires Professional plan or higher.", code: "PLAN_REQUIRED" },
        { status: 403 }
      );
    }

    // Fetch matches with evidence
    const { data: matches } = await adminClient
      .from("analysis_matches")
      .select("*")
      .eq("analysis_id", analysisId)
      .order("score_overall", { ascending: false });

    const matchesWithEvidence = [];
    for (const match of matches ?? []) {
      const { data: evidence } = await adminClient
        .from("match_evidence")
        .select("*")
        .eq("match_id", match.id);

      let refTitle = "Unknown", refArtist = "Unknown";
      if (match.reference_track_id) {
        const { data: ref } = await adminClient
          .from("reference_tracks")
          .select("title, artist")
          .eq("id", match.reference_track_id)
          .single();
        if (ref) { refTitle = ref.title; refArtist = ref.artist; }
      }

      matchesWithEvidence.push({ ...match, evidence: evidence ?? [], refTitle, refArtist });
    }

    // Fetch segments
    const { data: segments } = await adminClient
      .from("analysis_segments")
      .select("*")
      .eq("analysis_id", analysisId)
      .order("segment_index");

    // Fetch custody
    const { data: custody } = await adminClient
      .from("chain_of_custody")
      .select("*")
      .eq("entity_type", "analysis")
      .eq("entity_id", analysisId)
      .order("sequence_num");

    // Build ZIP using archiver
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));

    // 1. Analysis data JSON
    const analysisData = {
      analysis,
      matches: matchesWithEvidence,
      segments: segments ?? [],
      pipeline_version: analysis.pipeline_version,
      exported_at: new Date().toISOString(),
    };
    archive.append(JSON.stringify(analysisData, null, 2), { name: "analysis-data.json" });

    // 2. Chain of custody JSON
    const custodyData = {
      entries: custody ?? [],
      total_entries: custody?.length ?? 0,
      exported_at: new Date().toISOString(),
    };
    archive.append(JSON.stringify(custodyData, null, 2), { name: "chain-of-custody.json" });

    // 3. Methodology text
    const methodology = `PROBATIO Forensic Audio Analysis — Methodology Document
===========================================================

Pipeline Version: ${analysis.pipeline_version ?? "v1.0.0"}
Analysis ID: ${analysisId}
Generated: ${new Date().toISOString()}

1. AUDIO NORMALIZATION
   Target: 44.1kHz, 16-bit, mono
   All input audio is normalized to a canonical format.

2. SOURCE SEPARATION (Demucs htdemucs_ft v4.0.1)
   Audio is separated into 4 stems: vocals, bass, drums, other.
   Determinism enforced via fixed random seed (42).

3. FEATURE EXTRACTION
   CREPE v0.0.16 (full capacity): Pitch contour extraction
   librosa v0.10.1: Chroma, onsets, beats, tempo, key detection
   Segment size: 4 seconds, 2 second hop (50% overlap)

4. EMBEDDING GENERATION (CLAP)
   Model: laion/larger_clap_music_and_speech
   5 track-level embeddings: timbre, melody, harmony, rhythm, lyrics
   Per-segment embeddings for fine-grained matching
   Lyrics: Whisper large-v3 transcription + all-MiniLM-L6-v2 embedding (384→512 padded)

5. VECTOR SEARCH
   pgvector HNSW index, cosine similarity
   Dimension weights (with lyrics): melody 30%, harmony 20%, lyrics 20%, timbre 15%, rhythm 15%
   Dimension weights (instrumental): melody 37.5%, harmony 25%, timbre 18.75%, rhythm 18.75%

6. SEGMENT COMPARISON
   Dynamic Time Warping with transposition detection (-6 to +5 semitones)
   Chroma vector correlation for harmonic analysis
   Onset pattern correlation for rhythmic analysis

7. RISK CLASSIFICATION
   Critical: >=85% overall similarity
   High: >=60%
   Moderate: >=30%
   Low: >10%
   Clear: <=10%

8. CHAIN OF CUSTODY
   Every intermediate artifact is SHA-256 hashed.
   Hash chain enforced by database triggers (append-only, immutable).
   Verification: SELECT * FROM verify_custody_chain('analysis', '${analysisId}');

DISCLAIMER: This analysis does not constitute legal advice.
Similarity scores are statistical measures. Consult qualified counsel.
`;
    archive.append(methodology, { name: "methodology.txt" });

    // 4. Try to generate PDF
    try {
      const features = analysis.features as Record<string, unknown> | null;
      const pdfData: PDFReportData = {
        analysisId,
        fileName: analysis.file_name ?? "Unknown",
        fileHash: analysis.file_hash ?? "",
        durationSec: analysis.duration_seconds ?? 0,
        tempoBpm: (features?.rhythm as any)?.estimatedTempoBpm ?? null,
        key: (features?.key as any)?.key ?? null,
        overallRisk: analysis.overall_risk ?? "low",
        overallScore: analysis.overall_score ?? 0,
        pipelineVersion: analysis.pipeline_version ?? "v1.0.0",
        analyzedAt: analysis.completed_at ?? analysis.created_at,
        report: {
          executiveSummary: analysis.report_narrative?.split("\n\n")[0] ?? "",
          methodology: "See methodology.txt for full details.",
          riskAssessment: `Overall risk: ${analysis.overall_risk?.toUpperCase() ?? "LOW"}`,
          recommendations: "See full PDF report for recommendations.",
          limitations: "This analysis does not constitute legal advice.",
          matchAnalyses: [],
        },
        matches: matchesWithEvidence.map(m => ({
          id: m.id,
          referenceTitle: m.refTitle,
          referenceArtist: m.refArtist,
          scoreOverall: m.score_overall ?? 0,
          scoreMelody: m.score_melody,
          scoreHarmony: m.score_harmony,
          scoreRhythm: m.score_rhythm,
          scoreTimbre: m.score_timbre,
          riskLevel: m.risk_level ?? "low",
          rightsHolders: m.rights_holders,
          evidence: (m.evidence ?? []).map((e: any) => ({
            dimension: e.dimension,
            similarity: e.similarity_score,
            sourceStart: e.source_start_sec,
            sourceEnd: e.source_end_sec,
            targetStart: e.target_start_sec,
            targetEnd: e.target_end_sec,
            description: e.description ?? "",
          })),
        })),
        custodyChain: (custody ?? []).map((c: any) => ({
          sequenceNum: c.sequence_num,
          action: c.action,
          entryHash: c.entry_hash ?? "",
          artifactHash: c.artifact_hash,
          recordedAt: c.recorded_at,
        })),
        finalHash: analysis.final_hash ?? null,
      };

      const pdfBuffer = await generatePDFBuffer(pdfData);
      archive.append(pdfBuffer, { name: `probatio-report-${analysisId.slice(0, 8)}.pdf` });
    } catch (pdfErr) {
      console.error("PDF generation failed for evidence package:", pdfErr);
      archive.append("PDF generation failed. Use /api/reports/[id]/pdf endpoint separately.", { name: "pdf-error.txt" });
    }

    await archive.finalize();

    const zipBuffer = Buffer.concat(chunks);

    // Record custody
    await adminClient.from("chain_of_custody").insert({
      entity_type: "analysis",
      entity_id: analysisId,
      action: "evidence_packaged",
      actor_id: user.id,
      artifact_type: "evidence_package",
      detail: {
        format: "zip",
        includes: ["analysis-data.json", "chain-of-custody.json", "methodology.txt", "pdf-report"],
        exported_at: new Date().toISOString(),
      },
      recorded_at: new Date().toISOString(),
    });

    // Sign the ZIP buffer
    const responseHeaders: Record<string, string> = {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="probatio-evidence-${analysisId.slice(0, 8)}.zip"`,
      "Cache-Control": "no-store",
    };

    if (isSigningAvailable()) {
      const sig = signBuffer(zipBuffer);
      responseHeaders["X-Probatio-Signature"] = sig.signature;
      responseHeaders["X-Probatio-Signed-Hash"] = sig.signed_hash;
      responseHeaders["X-Probatio-Signature-Algorithm"] = sig.algorithm;
    }

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Evidence package error:", error);
    return NextResponse.json({ error: "Failed to generate evidence package" }, { status: 500 });
  }
}
