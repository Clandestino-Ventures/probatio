// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Clearance Certificate PDF Endpoint
 *
 * GET /api/reports/[analysisId]/certificate
 * Generates a single-page clearance certificate with QR code
 * linking to the public verification page.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateCertificateBuffer,
  type CertificateData,
} from "@/lib/report/clearance-certificate";
import {
  generateQRCodeDataUrl,
  buildVerificationUrl,
} from "@/lib/report/qr-code";
import { recordCustody } from "@/lib/custody";
import { formatDate } from "@/lib/utils";

function formatDuration(sec: number): string {
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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch analysis
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
        { error: "Certificates are only for clearance analyses" },
        { status: 400 },
      );
    }

    if (analysis.status !== "completed") {
      return NextResponse.json(
        { error: "Analysis not yet completed" },
        { status: 400 },
      );
    }

    // Get highest match score
    const { data: topMatch } = await admin
      .from("analysis_matches")
      .select("score_overall, reference_track_id")
      .eq("analysis_id", analysisId)
      .order("score_overall", { ascending: false })
      .limit(1)
      .single();

    const highestScore = topMatch?.score_overall ?? 0;

    // Get blocking matches (for conditional/blocked)
    let blockingMatches: CertificateData["blockingMatches"] = [];
    if (analysis.clearance_status !== "cleared") {
      const { data: matches } = await admin
        .from("analysis_matches")
        .select("score_overall, reference_track_id")
        .eq("analysis_id", analysisId)
        .gte("score_overall", 0.30)
        .order("score_overall", { ascending: false })
        .limit(5);

      if (matches) {
        const enriched = [];
        for (const m of matches) {
          let title = "Unknown Track";
          let artist = "Unknown";
          if (m.reference_track_id) {
            const { data: ref } = await admin
              .from("reference_tracks")
              .select("title, artist")
              .eq("id", m.reference_track_id)
              .single();
            if (ref) {
              title = ref.title;
              artist = ref.artist;
            }
          }
          enriched.push({
            title,
            artist,
            score: m.score_overall ?? 0,
          });
        }
        blockingMatches = enriched;
      }
    }

    // Get catalog info
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

    // Get chain of custody count
    const { count: chainCount } = await admin
      .from("audit_log")
      .select("*", { count: "exact", head: true })
      .eq("entity_id", analysisId);

    // Generate QR code
    const verificationUrl = buildVerificationUrl(analysis.file_hash);
    const qrCodeDataUrl = await generateQRCodeDataUrl(verificationUrl);

    // Build certificate data
    const certData: CertificateData = {
      trackTitle: analysis.file_name,
      artist: "",
      durationFormatted: analysis.duration_seconds
        ? formatDuration(analysis.duration_seconds)
        : "Unknown",
      fileHash: analysis.file_hash,
      language: analysis.lyrics_language,
      detectedGenre: analysis.detected_genre,
      genreConfidence: analysis.genre_confidence,
      analysisDate: formatDate(analysis.created_at),
      analysisId,
      pipelineVersion: analysis.pipeline_version ?? "1.0.0",
      catalogs,
      totalTracksScanned,
      highestMatchScore: highestScore,
      clearanceStatus: (analysis.clearance_status ?? "cleared") as
        | "cleared"
        | "conditional"
        | "blocked",
      chainEntryCount: chainCount ?? 0,
      qrCodeDataUrl,
      verificationUrl,
      verificationHash: analysis.file_hash,
      blockingMatches,
    };

    const pdfBuffer = await generateCertificateBuffer(certData);

    // Record custody
    await recordCustody({
      entityType: "analysis",
      entityId: analysisId,
      action: "certificate_generated",
      actorId: user.id,
      artifactType: "clearance_certificate",
      artifactHash: analysis.file_hash,
      detail: {
        clearance_status: analysis.clearance_status,
        verification_url: verificationUrl,
      },
    });

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="probatio-certificate-${analysisId.slice(0, 8)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[GET /api/reports/:id/certificate]", error);
    return NextResponse.json(
      { error: "Failed to generate certificate" },
      { status: 500 },
    );
  }
}
