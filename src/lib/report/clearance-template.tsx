import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface ClearancePDFData {
  analysisId: string;
  fileName: string;
  fileHash: string;
  durationSec: number;
  tempoBpm: number | null;
  key: string | null;
  detectedGenre: string | null;
  genreConfidence: number | null;
  clearanceStatus: "cleared" | "conditional" | "blocked";
  overallScore: number;
  pipelineVersion: string;
  analyzedAt: string;
  catalogs: Array<{ name: string; trackCount: number }>;
  totalTracksScanned: number;
  narrative: {
    executiveSummary: string;
    methodology: string;
    recommendations: string;
    limitations: string;
  };
  matches: Array<{
    rank: number;
    referenceTitle: string;
    referenceArtist: string;
    isrc: string | null;
    releaseYear: number | null;
    catalogName: string | null;
    riskLevel: string;
    scoreMelody: number | null;
    scoreHarmony: number | null;
    scoreRhythm: number | null;
    scoreTimbre: number | null;
    scoreLyrics: number | null;
    scoreOverall: number;
    scoreMelodyAdjusted: number | null;
    scoreHarmonyAdjusted: number | null;
    scoreRhythmAdjusted: number | null;
    scoreTimbreAdjusted: number | null;
    scoreLyricsAdjusted: number | null;
    scoreOverallAdjusted: number | null;
    finding: string;
    recommendation: string;
    evidence: Array<{
      sourceTime: string;
      targetTime: string;
      dimension: string;
      similarity: number;
      detail: string;
    }>;
  }>;
}

// ────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────

const COLORS = {
  cleared: "#22C55E",
  conditional: "#F59E0B",
  blocked: "#E63926",
  dark: "#1a1a2e",
  text: "#333333",
  muted: "#666666",
  light: "#8a8a8e",
  border: "#e0e0e0",
  bg: "#f8f8fa",
  white: "#ffffff",
  blue: "#2E6CE6",
};

const s = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: COLORS.dark,
    backgroundColor: COLORS.white,
  },
  // Cover
  coverCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  coverTitle: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: COLORS.dark,
    textAlign: "center",
    marginBottom: 30,
    letterSpacing: 2,
  },
  coverTrack: {
    fontSize: 16,
    textAlign: "center",
    color: COLORS.text,
    marginBottom: 4,
  },
  coverMeta: {
    fontSize: 10,
    textAlign: "center",
    color: COLORS.muted,
    marginBottom: 24,
  },
  verdictBox: {
    padding: "16 40",
    borderRadius: 6,
    marginBottom: 30,
    alignItems: "center",
  },
  verdictText: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: COLORS.white,
    textAlign: "center",
  },
  verdictSub: {
    fontSize: 11,
    color: COLORS.white,
    textAlign: "center",
    marginTop: 4,
    opacity: 0.9,
  },
  coverCatalogs: {
    fontSize: 10,
    textAlign: "center",
    color: COLORS.muted,
    marginBottom: 4,
  },
  coverFooter: {
    fontSize: 9,
    textAlign: "center",
    color: COLORS.light,
    marginTop: 30,
  },
  // Sections
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: COLORS.dark,
    marginBottom: 10,
    marginTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 4,
  },
  body: {
    fontSize: 10,
    lineHeight: 1.6,
    color: COLORS.text,
    marginBottom: 8,
  },
  label: {
    fontSize: 9,
    color: COLORS.muted,
    marginBottom: 2,
  },
  bold: {
    fontFamily: "Helvetica-Bold",
  },
  // Match card
  matchCard: {
    marginBottom: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
  },
  matchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  matchTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: COLORS.dark,
  },
  matchArtist: {
    fontSize: 10,
    color: COLORS.muted,
  },
  riskBadge: {
    padding: "2 8",
    borderRadius: 3,
  },
  riskBadgeText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: COLORS.white,
  },
  // Score table
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    paddingVertical: 3,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.dark,
    paddingVertical: 4,
  },
  cellDim: { width: "20%", fontSize: 9 },
  cellScore: { width: "16%", fontSize: 9, textAlign: "center" },
  cellStatus: { width: "32%", fontSize: 9 },
  // Evidence table
  evCellTime: { width: "22%", fontSize: 8 },
  evCellDim: { width: "18%", fontSize: 8 },
  evCellSim: { width: "14%", fontSize: 8, textAlign: "center" },
  evCellDetail: { width: "24%", fontSize: 8 },
  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: COLORS.light,
  },
  confidential: {
    fontSize: 8,
    color: COLORS.blocked,
    textTransform: "uppercase" as const,
    letterSpacing: 2,
    marginBottom: 8,
  },
});

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const ss = Math.floor(sec % 60);
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

function riskColor(level: string): string {
  if (level === "critical") return COLORS.blocked;
  if (level === "high") return "#F97316";
  if (level === "moderate") return COLORS.conditional;
  return COLORS.cleared;
}

function verdictLabel(status: string): string {
  if (status === "cleared") return "CLEARED FOR RELEASE";
  if (status === "conditional") return "CONDITIONAL — REVIEW REQUIRED";
  return "BLOCKED — DO NOT RELEASE";
}

function verdictSubtext(status: string, matchCount: number): string {
  if (status === "cleared") return "No actionable matches found";
  if (status === "conditional")
    return `${matchCount} match${matchCount !== 1 ? "es" : ""} require${matchCount === 1 ? "s" : ""} legal review`;
  return `${matchCount} high-risk match${matchCount !== 1 ? "es" : ""} detected`;
}

function scoreStatus(
  raw: number | null,
  adjusted: number | null,
): string {
  if (raw == null) return "N/A";
  if (adjusted != null && adjusted >= 0.60) return "ABOVE THRESHOLD";
  if (adjusted != null && adjusted >= 0.40) return "REVIEW NEEDED";
  if (adjusted != null && adjusted < 0.20) return "Genre baseline";
  return "Within range";
}

function scoreStatusSymbol(
  raw: number | null,
  adjusted: number | null,
): string {
  if (raw == null) return "—";
  if (adjusted != null && adjusted >= 0.60) return "!!";
  if (adjusted != null && adjusted >= 0.40) return "!";
  return "";
}

// ────────────────────────────────────────────────────────────────
// Document Component
// ────────────────────────────────────────────────────────────────

function ClearanceReport({ data }: { data: ClearancePDFData }) {
  const verdictColor = COLORS[data.clearanceStatus] ?? COLORS.conditional;
  const actionableMatches = data.matches.filter(
    (m) => m.scoreOverall >= 0.30,
  );

  return (
    <Document>
      {/* ── PAGE 1: COVER ─────────────────────────────────── */}
      <Page size="A4" style={s.page}>
        <Text style={s.confidential}>CONFIDENTIAL — PRE-RELEASE</Text>
        <View style={s.coverCenter}>
          <Text style={s.coverTitle}>PRE-RELEASE{"\n"}CLEARANCE REPORT</Text>

          <Text style={s.coverTrack}>
            &ldquo;{data.fileName}&rdquo;
          </Text>
          <Text style={s.coverMeta}>
            Duration: {formatTime(data.durationSec)}
            {data.detectedGenre
              ? ` · Genre: ${data.detectedGenre} (${data.genreConfidence ? Math.round(data.genreConfidence * 100) : "?"}%)`
              : ""}
            {data.key ? ` · Key: ${data.key}` : ""}
          </Text>

          {/* Verdict Box */}
          <View
            style={[
              s.verdictBox,
              { backgroundColor: verdictColor },
            ]}
          >
            <Text style={s.verdictText}>
              {verdictLabel(data.clearanceStatus)}
            </Text>
            <Text style={s.verdictSub}>
              {verdictSubtext(
                data.clearanceStatus,
                actionableMatches.length,
              )}
            </Text>
          </View>

          {/* Catalogs scanned */}
          {data.catalogs.map((cat, i) => (
            <Text key={i} style={s.coverCatalogs}>
              Scanned against: &ldquo;{cat.name}&rdquo; (
              {cat.trackCount.toLocaleString()} tracks)
            </Text>
          ))}
          <Text style={s.coverCatalogs}>
            Total: {data.totalTracksScanned.toLocaleString()} reference
            tracks scanned
          </Text>

          <Text style={s.coverMeta}>
            Analysis Date: {data.analyzedAt} · Pipeline: v
            {data.pipelineVersion}
            {"\n"}Analysis ID: {data.analysisId}
            {"\n"}File Hash (SHA-256): {data.fileHash.slice(0, 16)}...
            {data.fileHash.slice(-8)}
          </Text>

          <Text style={s.coverFooter}>
            Probatio · probatio.audio · Clandestino Ventures, LLC
            {"\n"}The proof is in the signal.
          </Text>
        </View>
        <View style={s.footer}>
          <Text>PROBATIO Clearance Report</Text>
          <Text>Page 1</Text>
        </View>
      </Page>

      {/* ── PAGE 2: EXECUTIVE SUMMARY ─────────────────────── */}
      <Page size="A4" style={s.page}>
        <Text style={s.confidential}>CONFIDENTIAL — PRE-RELEASE</Text>

        <Text style={s.sectionTitle}>Executive Summary</Text>
        <Text style={s.body}>{data.narrative.executiveSummary}</Text>

        <Text style={s.sectionTitle}>Scan Scope</Text>
        <Text style={s.body}>
          This analysis scanned the submitted track against{" "}
          {data.catalogs.length} reference catalog
          {data.catalogs.length !== 1 ? "s" : ""} containing a total of{" "}
          {data.totalTracksScanned.toLocaleString()} tracks.{" "}
          {actionableMatches.length} match
          {actionableMatches.length !== 1 ? "es" : ""} exceeded the
          actionable threshold.
        </Text>

        <Text style={s.sectionTitle}>Analysis Dimensions</Text>
        <Text style={s.body}>
          This analysis evaluated 5 dimensions: melody (30%), harmony
          (20%), lyrics (20%), timbre (15%), rhythm (15%). Scores are
          genre-adjusted to account for genre-typical patterns.
          {data.detectedGenre
            ? ` The analyzed track was identified as ${data.detectedGenre} (${data.genreConfidence ? Math.round(data.genreConfidence * 100) : "?"}% confidence). Similarity scores below the genre baseline are considered normal for this genre.`
            : ""}
        </Text>

        <Text style={s.sectionTitle}>Recommendations</Text>
        <Text style={s.body}>{data.narrative.recommendations}</Text>

        <View style={s.footer}>
          <Text>PROBATIO Clearance Report</Text>
          <Text>Page 2</Text>
        </View>
      </Page>

      {/* ── PAGES 3+: MATCH DETAILS ───────────────────────── */}
      {actionableMatches.length > 0 && (
        <Page size="A4" style={s.page} wrap>
          <Text style={s.confidential}>CONFIDENTIAL — PRE-RELEASE</Text>
          <Text style={s.sectionTitle}>Match Details</Text>

          {actionableMatches.map((match, mi) => (
            <View
              key={mi}
              style={s.matchCard}
              wrap={false}
            >
              {/* Match Header */}
              <View style={s.matchHeader}>
                <View>
                  <Text style={s.matchTitle}>
                    Match #{match.rank} — &ldquo;
                    {match.referenceTitle}&rdquo;
                  </Text>
                  <Text style={s.matchArtist}>
                    {match.referenceArtist}
                    {match.isrc ? ` · ISRC: ${match.isrc}` : ""}
                    {match.releaseYear
                      ? ` · ${match.releaseYear}`
                      : ""}
                    {match.catalogName
                      ? ` · ${match.catalogName}`
                      : ""}
                  </Text>
                </View>
                <View
                  style={[
                    s.riskBadge,
                    {
                      backgroundColor: riskColor(
                        match.riskLevel,
                      ),
                    },
                  ]}
                >
                  <Text style={s.riskBadgeText}>
                    {match.riskLevel.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Dimension Scores Table */}
              <View style={s.tableHeader}>
                <Text style={[s.cellDim, s.bold]}>Dimension</Text>
                <Text style={[s.cellScore, s.bold]}>Raw</Text>
                <Text style={[s.cellScore, s.bold]}>Adjusted</Text>
                <Text style={[s.cellStatus, s.bold]}>Status</Text>
              </View>
              {(
                [
                  ["Melody", match.scoreMelody, match.scoreMelodyAdjusted],
                  ["Harmony", match.scoreHarmony, match.scoreHarmonyAdjusted],
                  ["Rhythm", match.scoreRhythm, match.scoreRhythmAdjusted],
                  ["Timbre", match.scoreTimbre, match.scoreTimbreAdjusted],
                  ["Lyrics", match.scoreLyrics, match.scoreLyricsAdjusted],
                  ["OVERALL", match.scoreOverall, match.scoreOverallAdjusted],
                ] as [string, number | null, number | null][]
              ).map(([dim, raw, adj], di) => (
                <View
                  key={di}
                  style={di % 2 === 0 ? s.tableRow : [s.tableRow, { backgroundColor: COLORS.bg }]}
                >
                  <Text style={[s.cellDim, dim === "OVERALL" ? s.bold : {}]}>
                    {scoreStatusSymbol(raw, adj)} {dim}
                  </Text>
                  <Text style={s.cellScore}>
                    {raw != null
                      ? `${(raw * 100).toFixed(0)}%`
                      : "N/A"}
                  </Text>
                  <Text style={s.cellScore}>
                    {adj != null
                      ? `${(adj * 100).toFixed(0)}%`
                      : "—"}
                  </Text>
                  <Text style={s.cellStatus}>
                    {scoreStatus(raw, adj)}
                  </Text>
                </View>
              ))}

              {/* Finding */}
              <Text style={[s.body, { marginTop: 8 }]}>
                <Text style={s.bold}>Key Finding: </Text>
                {match.finding}
              </Text>

              {/* Recommendation */}
              <Text style={s.body}>
                <Text style={s.bold}>Recommendation: </Text>
                {match.recommendation}
              </Text>

              {/* Evidence Table */}
              {match.evidence.length > 0 && (
                <View style={{ marginTop: 4 }}>
                  <Text style={[s.label, s.bold]}>
                    Top Evidence Points:
                  </Text>
                  <View style={s.tableHeader}>
                    <Text style={[s.evCellTime, s.bold]}>
                      Source
                    </Text>
                    <Text style={[s.evCellTime, s.bold]}>
                      Reference
                    </Text>
                    <Text style={[s.evCellDim, s.bold]}>
                      Dimension
                    </Text>
                    <Text style={[s.evCellSim, s.bold]}>
                      Similarity
                    </Text>
                    <Text style={[s.evCellDetail, s.bold]}>
                      Detail
                    </Text>
                  </View>
                  {match.evidence.slice(0, 5).map((ev, ei) => (
                    <View key={ei} style={s.tableRow}>
                      <Text style={s.evCellTime}>
                        {ev.sourceTime}
                      </Text>
                      <Text style={s.evCellTime}>
                        {ev.targetTime}
                      </Text>
                      <Text style={s.evCellDim}>
                        {ev.dimension}
                      </Text>
                      <Text style={s.evCellSim}>
                        {(ev.similarity * 100).toFixed(0)}%
                      </Text>
                      <Text style={s.evCellDetail}>
                        {ev.detail}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}

          <View style={s.footer}>
            <Text>PROBATIO Clearance Report</Text>
            <Text>Match Details</Text>
          </View>
        </Page>
      )}

      {/* ── FINAL PAGE: METHODOLOGY + DISCLAIMERS ────────── */}
      <Page size="A4" style={s.page}>
        <Text style={s.confidential}>CONFIDENTIAL — PRE-RELEASE</Text>

        <Text style={s.sectionTitle}>Methodology</Text>
        <Text style={s.body}>{data.narrative.methodology}</Text>

        <Text style={s.sectionTitle}>Limitations</Text>
        <Text style={s.body}>{data.narrative.limitations}</Text>

        <Text style={s.sectionTitle}>Legal Disclaimer</Text>
        <Text style={s.body}>
          This report provides a technical analysis of audio similarity. It
          does not constitute legal advice. Similarity scores indicate
          technical resemblance and do not determine copyright
          infringement, which is a legal conclusion that can only be made
          by a court of law. The admissibility of this report as evidence
          is at the discretion of the presiding court. Probatio analysis
          should be reviewed by qualified legal counsel before making
          release decisions.
        </Text>

        <Text style={s.sectionTitle}>Chain of Custody</Text>
        <Text style={s.body}>
          Analysis ID: {data.analysisId}
          {"\n"}File Hash (SHA-256): {data.fileHash}
          {"\n"}Pipeline Version: {data.pipelineVersion}
          {"\n"}Analysis Date: {data.analyzedAt}
        </Text>

        <View style={s.footer}>
          <Text>PROBATIO Clearance Report</Text>
          <Text>
            Clandestino Ventures, LLC {"\u00A9"} 2026
          </Text>
        </View>
      </Page>
    </Document>
  );
}

// ────────────────────────────────────────────────────────────────
// Buffer Generation
// ────────────────────────────────────────────────────────────────

export async function generateClearancePDFBuffer(
  data: ClearancePDFData,
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(ClearanceReport, { data }) as any;
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}
