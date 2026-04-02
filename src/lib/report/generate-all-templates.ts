/**
 * PROBATIO — Generate All PDF Templates
 *
 * Generates all 5 PDF document formats with realistic sample data.
 * Print these and hand to the attorney for format/content review.
 *
 * Usage: npm run templates
 *        npx tsx src/lib/report/generate-all-templates.ts
 *
 * Outputs to: /tmp/probatio-templates/
 */

import { mkdirSync, writeFileSync } from "fs";
import {
  SAMPLE_FORENSIC,
  SAMPLE_CLEARANCE,
  SAMPLE_CERTIFICATE,
  SAMPLE_BATCH,
  SAMPLE_SCREENING,
} from "./sample-data";
import { generateClearancePDFBuffer, type ClearancePDFData } from "./clearance-template";
import { generateCertificateBuffer, type CertificateData } from "./clearance-certificate";
import { generatePDFBuffer, type PDFReportData } from "./pdf-generator";
import { generateQRCodeDataUrl, buildVerificationUrl } from "./qr-code";

import { resolve } from "path";

const OUTPUT_DIR = resolve(__dirname, "../../../generated-pdfs");

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`\nPROBATIO \u2014 Generating PDF Templates\n${"=".repeat(45)}\n`);

  // ── 1. Forensic Evidence Report (15 pages) ──────────────────
  console.log("[1/5] Forensic Evidence Report (15-page)...");
  const forensicQR = await generateQRCodeDataUrl(
    buildVerificationUrl(SAMPLE_FORENSIC.track_a.file_hash),
  );
  // Use the upgraded PDFReportData with all forensic fields
  const forensicPdfData: PDFReportData = {
    analysisId: SAMPLE_FORENSIC.case_id,
    fileName: SAMPLE_FORENSIC.track_a.title,
    fileHash: SAMPLE_FORENSIC.track_a.file_hash,
    durationSec: SAMPLE_FORENSIC.track_a.duration_sec,
    tempoBpm: SAMPLE_FORENSIC.track_a.tempo_bpm,
    key: SAMPLE_FORENSIC.track_a.key,
    overallRisk: SAMPLE_FORENSIC.risk_level,
    overallScore: SAMPLE_FORENSIC.overall_raw,
    pipelineVersion: SAMPLE_FORENSIC.pipeline.tag,
    analyzedAt: SAMPLE_FORENSIC.created_at,
    detectedGenre: SAMPLE_FORENSIC.track_a.genre,
    genreConfidence: SAMPLE_FORENSIC.track_a.genre_confidence,
    overallAdjusted: SAMPLE_FORENSIC.overall_adjusted,
    qrCodeDataUrl: forensicQR,
    caseName: SAMPLE_FORENSIC.case_name,
    caseId: SAMPLE_FORENSIC.case_id,
    dimensionScores: {
      melody: SAMPLE_FORENSIC.scores.melody,
      harmony: SAMPLE_FORENSIC.scores.harmony,
      rhythm: SAMPLE_FORENSIC.scores.rhythm,
      timbre: SAMPLE_FORENSIC.scores.timbre,
      lyrics: SAMPLE_FORENSIC.scores.lyrics,
    },
    multiResolution: SAMPLE_FORENSIC.multi_resolution,
    dimensionExplanations: SAMPLE_FORENSIC.narrative.dimension_explanations,
    expertAnnotations: SAMPLE_FORENSIC.expert_annotations,
    pipelineModels: Object.fromEntries(
      Object.entries(SAMPLE_FORENSIC.pipeline).filter(([k]) => k !== "tag"),
    ),
    report: {
      executiveSummary: SAMPLE_FORENSIC.narrative.executive_summary,
      methodology: "Analysis performed using Probatio v" + SAMPLE_FORENSIC.pipeline.tag + " with five-dimension forensic analysis pipeline.",
      riskAssessment: SAMPLE_FORENSIC.narrative.risk_assessment,
      recommendations: SAMPLE_FORENSIC.narrative.recommendations,
      limitations: SAMPLE_FORENSIC.narrative.limitations,
      matchAnalyses: [],
    },
    matches: [{
      id: "match-forensic-001",
      referenceTitle: SAMPLE_FORENSIC.track_b.title,
      referenceArtist: SAMPLE_FORENSIC.track_b.artist,
      scoreOverall: SAMPLE_FORENSIC.overall_raw,
      scoreMelody: SAMPLE_FORENSIC.scores.melody.raw,
      scoreHarmony: SAMPLE_FORENSIC.scores.harmony.raw,
      scoreRhythm: SAMPLE_FORENSIC.scores.rhythm.raw,
      scoreTimbre: SAMPLE_FORENSIC.scores.timbre.raw,
      scoreLyrics: SAMPLE_FORENSIC.scores.lyrics.raw,
      riskLevel: SAMPLE_FORENSIC.risk_level,
      rightsHolders: null,
      evidence: SAMPLE_FORENSIC.evidence.map((e) => ({
        dimension: e.dimension,
        similarity: e.similarity,
        sourceStart: 0,
        sourceEnd: 0,
        targetStart: 0,
        targetEnd: 0,
        description: `${e.dimension}: ${Math.round(e.similarity * 100)}%`,
        transposition: e.transposition,
        resolution: e.resolution,
      })),
    }],
    custodyChain: SAMPLE_FORENSIC.custody_chain.map((c) => ({
      sequenceNum: c.sequence,
      action: c.action,
      entryHash: c.hash,
      artifactHash: null,
      recordedAt: c.timestamp,
    })),
    finalHash: SAMPLE_FORENSIC.custody_chain[SAMPLE_FORENSIC.custody_chain.length - 1]?.hash ?? null,
  };
  const forensicBuf = await generatePDFBuffer(forensicPdfData);
  writeFileSync(`${OUTPUT_DIR}/01_FORENSIC_EVIDENCE_REPORT.pdf`, forensicBuf);
  console.log(`  \u2713 ${forensicBuf.length} bytes`);

  // ── 2. Pre-Release Clearance Report ─────────────────────────
  console.log("[2/5] Pre-Release Clearance Report...");
  const clearanceData: ClearancePDFData = {
    analysisId: SAMPLE_CLEARANCE.analysisId,
    fileName: SAMPLE_CLEARANCE.track.title,
    fileHash: SAMPLE_CLEARANCE.track.file_hash,
    durationSec: SAMPLE_CLEARANCE.track.duration_sec,
    tempoBpm: SAMPLE_CLEARANCE.track.tempo_bpm,
    key: SAMPLE_CLEARANCE.track.key,
    detectedGenre: SAMPLE_CLEARANCE.track.genre,
    genreConfidence: SAMPLE_CLEARANCE.track.genre_confidence,
    clearanceStatus: SAMPLE_CLEARANCE.verdict,
    overallScore: SAMPLE_CLEARANCE.matches[0]?.overall.raw ?? 0,
    pipelineVersion: SAMPLE_CLEARANCE.pipelineVersion,
    analyzedAt: SAMPLE_CLEARANCE.analyzedAt,
    catalogs: SAMPLE_CLEARANCE.catalogs,
    totalTracksScanned: SAMPLE_CLEARANCE.totalScanned,
    narrative: {
      executiveSummary:
        "Pre-release clearance analysis detected 2 matches requiring review. " +
        'The highest match ("Brilla en la Noche" by Sofia Reyes) shows 60% genre-adjusted ' +
        "melodic similarity in the verse section. Legal review is recommended.",
      methodology:
        "Analysis performed using Probatio v1.2.0. Five-dimension analysis: " +
        "melody (30%), harmony (20%), lyrics (20%), timbre (15%), rhythm (15%). " +
        "Genre-aware baselines applied for Latin Pop.",
      recommendations:
        "1. Review the verse melody of Track 1 match with legal counsel.\n" +
        "2. Track 2 match is within normal range \u2014 no action required.\n" +
        "3. Consider modifying the melodic phrase at 0:24-0:40 if clearance cannot be obtained.",
      limitations:
        "This analysis does not constitute legal advice. Similarity scores represent " +
        "technical resemblance only. The reference catalog represents a subset of all copyrighted works.",
    },
    matches: SAMPLE_CLEARANCE.matches.map((m) => ({
      rank: m.rank,
      referenceTitle: m.title,
      referenceArtist: m.artist,
      isrc: m.isrc,
      releaseYear: m.releaseYear,
      catalogName: m.catalog,
      riskLevel: m.risk,
      scoreMelody: m.scores.melody.raw,
      scoreHarmony: m.scores.harmony.raw,
      scoreRhythm: m.scores.rhythm.raw,
      scoreTimbre: m.scores.timbre.raw,
      scoreLyrics: m.scores.lyrics.raw,
      scoreOverall: m.overall.raw,
      scoreMelodyAdjusted: m.scores.melody.adjusted,
      scoreHarmonyAdjusted: m.scores.harmony.adjusted,
      scoreRhythmAdjusted: m.scores.rhythm.adjusted,
      scoreTimbreAdjusted: m.scores.timbre.adjusted,
      scoreLyricsAdjusted: m.scores.lyrics.adjusted,
      scoreOverallAdjusted: m.overall.adjusted,
      finding: m.finding,
      recommendation: m.recommendation,
      evidence: (m.evidence ?? []).map((e) => ({
        sourceTime: e.sourceTime,
        targetTime: e.targetTime,
        dimension: e.dimension,
        similarity: e.similarity,
        detail: e.detail ?? "",
      })),
    })),
  };
  const clearanceBuf = await generateClearancePDFBuffer(clearanceData);
  writeFileSync(`${OUTPUT_DIR}/02_CLEARANCE_REPORT.pdf`, clearanceBuf);
  console.log(`  \u2713 ${clearanceBuf.length} bytes`);

  // ── 3. Clearance Certificate (1 page) ───────────────────────
  console.log("[3/5] Clearance Certificate...");
  const certQR = await generateQRCodeDataUrl(
    buildVerificationUrl(SAMPLE_CERTIFICATE.fileHash),
  );
  const certData: CertificateData = {
    ...SAMPLE_CERTIFICATE,
    qrCodeDataUrl: certQR,
    verificationUrl: buildVerificationUrl(SAMPLE_CERTIFICATE.fileHash),
    verificationHash: SAMPLE_CERTIFICATE.fileHash,
  };
  const certBuf = await generateCertificateBuffer(certData);
  writeFileSync(`${OUTPUT_DIR}/03_CLEARANCE_CERTIFICATE.pdf`, certBuf);
  console.log(`  \u2713 ${certBuf.length} bytes`);

  // ── 4. Batch Clearance Report ───────────────────────────────
  console.log("[4/5] Batch Clearance Report...");
  // Reuse clearance template with batch-level data
  const batchData: ClearancePDFData = {
    analysisId: SAMPLE_BATCH.batchId,
    fileName: SAMPLE_BATCH.batchName,
    fileHash: `batch:${SAMPLE_BATCH.batchId}`,
    durationSec: 0,
    tempoBpm: null,
    key: null,
    detectedGenre: "Various",
    genreConfidence: null,
    clearanceStatus: SAMPLE_BATCH.overallVerdict,
    overallScore: 0.59,
    pipelineVersion: SAMPLE_BATCH.pipelineVersion,
    analyzedAt: SAMPLE_BATCH.analyzedAt,
    catalogs: SAMPLE_BATCH.catalogs,
    totalTracksScanned: SAMPLE_BATCH.totalScanned,
    narrative: {
      executiveSummary:
        `Batch clearance of ${SAMPLE_BATCH.tracks.length} tracks: ` +
        `${SAMPLE_BATCH.tracks.filter((t) => t.verdict === "cleared").length} cleared, ` +
        `${SAMPLE_BATCH.tracks.filter((t) => t.verdict === "conditional").length} conditional. ` +
        "Overall verdict: CONDITIONAL. Two tracks require review before release.",
      methodology: "Analysis performed using Probatio v1.2.0 with five-dimension scoring.",
      recommendations:
        "1. Track 02 (Luna Nueva): Review verse melody similarity.\n" +
        "2. Track 06 (Amanecer): Review melodic overlap with catalog match.\n" +
        "3. Remaining 6 tracks are cleared for release.",
      limitations: "This analysis does not constitute legal advice.",
    },
    matches: SAMPLE_BATCH.tracks
      .filter((t) => t.verdict !== "cleared")
      .map((t, i) => ({
        rank: i + 1,
        referenceTitle: t.title,
        referenceArtist: "Various",
        isrc: null,
        releaseYear: null,
        catalogName: null,
        riskLevel: t.verdict === "conditional" ? "moderate" : "low",
        scoreMelody: t.score * 1.1,
        scoreHarmony: t.score * 0.8,
        scoreRhythm: t.score * 0.7,
        scoreTimbre: t.score * 0.5,
        scoreLyrics: t.score * 0.4,
        scoreOverall: t.score,
        scoreMelodyAdjusted: null,
        scoreHarmonyAdjusted: null,
        scoreRhythmAdjusted: null,
        scoreTimbreAdjusted: null,
        scoreLyricsAdjusted: null,
        scoreOverallAdjusted: null,
        finding: `${t.matches} match(es) detected. Overall score: ${Math.round(t.score * 100)}%.`,
        recommendation: t.verdict === "conditional" ? "Review with legal counsel." : "No action required.",
        evidence: [],
      })),
  };
  const batchBuf = await generateClearancePDFBuffer(batchData);
  writeFileSync(`${OUTPUT_DIR}/04_BATCH_CLEARANCE_REPORT.pdf`, batchBuf);
  console.log(`  \u2713 ${batchBuf.length} bytes`);

  // ── 5. Screening Analysis Report ────────────────────────────
  console.log("[5/5] Screening Analysis Report...");
  const screeningData: PDFReportData = {
    analysisId: SAMPLE_SCREENING.analysisId,
    fileName: SAMPLE_SCREENING.fileName,
    fileHash: SAMPLE_SCREENING.fileHash,
    durationSec: SAMPLE_SCREENING.durationSec,
    tempoBpm: SAMPLE_SCREENING.tempoBpm,
    key: SAMPLE_SCREENING.key,
    overallRisk: SAMPLE_SCREENING.overallRisk,
    overallScore: SAMPLE_SCREENING.overallScore,
    pipelineVersion: SAMPLE_SCREENING.pipelineVersion,
    analyzedAt: SAMPLE_SCREENING.analyzedAt,
    report: {
      executiveSummary:
        `Screening analysis of "${SAMPLE_SCREENING.fileName}" detected ${SAMPLE_SCREENING.matchCount} matches. ` +
        "Highest similarity: 52% (moderate risk). No critical matches found.",
      methodology: "Five-dimension analysis with genre-aware baselines.",
      riskAssessment: "Moderate risk. Review recommended for the highest match.",
      recommendations: "1. Review match with legal counsel if proceeding to release.",
      limitations: "This analysis does not constitute legal advice.",
      matchAnalyses: SAMPLE_SCREENING.matches.map((m) => ({
        matchId: `match-${m.title.replace(/\s/g, "-").toLowerCase()}`,
        title: m.title,
        artist: m.artist,
        overallSimilarity: m.scoreOverall,
        riskLevel: m.riskLevel,
        narrative: `Overall similarity of ${Math.round(m.scoreOverall * 100)}%. ${m.riskLevel} risk.`,
        keyEvidence: m.evidence.map(
          (e) => `${e.dimension}: ${Math.round(e.similarity * 100)}% at ${e.sourceTime}`,
        ),
        recommendation: m.riskLevel === "moderate" ? "Review with legal counsel." : "No action required.",
      })),
    },
    matches: SAMPLE_SCREENING.matches.map((m) => ({
      id: `match-${m.title.replace(/\s/g, "-").toLowerCase()}`,
      referenceTitle: m.title,
      referenceArtist: m.artist,
      scoreOverall: m.scoreOverall,
      scoreMelody: m.scoreMelody,
      scoreHarmony: m.scoreHarmony,
      scoreRhythm: m.scoreRhythm,
      scoreTimbre: m.scoreTimbre,
      riskLevel: m.riskLevel,
      rightsHolders: null,
      evidence: m.evidence.map((e) => ({
        dimension: e.dimension,
        similarity: e.similarity,
        sourceStart: 0,
        sourceEnd: 0,
        targetStart: 0,
        targetEnd: 0,
        description: `${e.dimension}: ${Math.round(e.similarity * 100)}%`,
      })),
    })),
    custodyChain: [],
    finalHash: SAMPLE_SCREENING.fileHash,
  };
  const screeningBuf = await generatePDFBuffer(screeningData);
  writeFileSync(`${OUTPUT_DIR}/05_SCREENING_REPORT.pdf`, screeningBuf);
  console.log(`  \u2713 ${screeningBuf.length} bytes`);

  console.log(`\n${"=".repeat(45)}`);
  console.log(`\u2705 Generated 5 PDF templates in ${OUTPUT_DIR}`);
  console.log("Print these and hand to attorney for review.\n");
}

main().catch((err) => {
  console.error("Failed to generate templates:", err);
  process.exit(1);
});
