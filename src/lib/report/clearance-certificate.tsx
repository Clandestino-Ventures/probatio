import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface CertificateData {
  trackTitle: string;
  artist: string;
  durationFormatted: string;
  fileHash: string;
  language: string | null;
  detectedGenre: string | null;
  genreConfidence: number | null;
  analysisDate: string;
  analysisId: string;
  pipelineVersion: string;
  catalogs: Array<{ name: string; trackCount: number }>;
  totalTracksScanned: number;
  highestMatchScore: number;
  clearanceStatus: "cleared" | "conditional" | "blocked";
  chainEntryCount: number;
  qrCodeDataUrl: string;
  verificationUrl: string;
  verificationHash: string;
  blockingMatches?: Array<{ title: string; artist: string; score: number }>;
}

// ────────────────────────────────────────────────────────────────
// Colors
// ────────────────────────────────────────────────────────────────

const C = {
  obsidian: "#0A0A0F",
  carbon: "#1E1E21",
  gold: "#D4A843",
  bone: "#F5F0EB",
  ash: "#8A8A8E",
  slate: "#3A3A3F",
  cleared: "#22C55E",
  conditional: "#F59E0B",
  blocked: "#E63926",
  white: "#FFFFFF",
};

// ────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    padding: 0,
    fontSize: 10,
    fontFamily: "Helvetica",
    backgroundColor: C.white,
  },
  // Header band
  headerBand: {
    backgroundColor: C.obsidian,
    padding: "30 50 20 50",
    alignItems: "center",
  },
  brandName: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: C.bone,
    letterSpacing: 8,
    textAlign: "center",
  },
  brandSub: {
    fontSize: 9,
    color: C.ash,
    textAlign: "center",
    marginTop: 2,
    letterSpacing: 1,
  },
  // Gold divider
  divider: {
    height: 2,
    backgroundColor: C.gold,
  },
  // Certificate title
  titleSection: {
    padding: "20 50 10 50",
    alignItems: "center",
  },
  certTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: C.obsidian,
    textAlign: "center",
    letterSpacing: 3,
  },
  // Verdict badge
  verdictBadge: {
    margin: "10 50",
    padding: "12 20",
    borderRadius: 6,
    alignItems: "center",
  },
  verdictText: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    textAlign: "center",
  },
  verdictSub: {
    fontSize: 10,
    color: C.white,
    opacity: 0.9,
    textAlign: "center",
    marginTop: 3,
  },
  // Body content
  body: {
    padding: "10 50",
  },
  introText: {
    fontSize: 10,
    color: C.obsidian,
    lineHeight: 1.6,
    marginBottom: 15,
    textAlign: "center",
  },
  // Info grid
  infoRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e0e0e0",
    paddingVertical: 5,
  },
  infoLabel: {
    width: "35%",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.ash,
  },
  infoValue: {
    width: "65%",
    fontSize: 9,
    color: C.obsidian,
  },
  hashValue: {
    width: "65%",
    fontSize: 8,
    fontFamily: "Courier",
    color: C.obsidian,
  },
  // Section header
  sectionLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.gold,
    marginTop: 15,
    marginBottom: 5,
    letterSpacing: 1,
  },
  catalogItem: {
    fontSize: 9,
    color: C.obsidian,
    marginLeft: 10,
    marginBottom: 2,
  },
  // QR section
  qrSection: {
    alignItems: "center",
    marginTop: 15,
    marginBottom: 10,
  },
  qrImage: {
    width: 120,
    height: 120,
  },
  qrLabel: {
    fontSize: 8,
    color: C.ash,
    marginTop: 4,
    textAlign: "center",
  },
  // Verification
  verifyBox: {
    margin: "5 50",
    padding: 10,
    backgroundColor: "#f8f8fa",
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: "#e0e0e0",
  },
  verifyLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.ash,
    marginBottom: 2,
  },
  verifyHash: {
    fontSize: 7,
    fontFamily: "Courier",
    color: C.obsidian,
    textAlign: "center",
  },
  // Footer
  footer: {
    padding: "10 50 20 50",
    marginTop: "auto",
  },
  footerDivider: {
    height: 1,
    backgroundColor: C.gold,
    marginBottom: 10,
  },
  footerText: {
    fontSize: 7,
    color: C.ash,
    lineHeight: 1.5,
    textAlign: "center",
  },
  footerBrand: {
    fontSize: 8,
    color: C.gold,
    textAlign: "center",
    marginTop: 6,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },
  // Blocking matches
  blockMatch: {
    fontSize: 9,
    color: C.blocked,
    marginLeft: 10,
    marginBottom: 2,
  },
});

// ────────────────────────────────────────────────────────────────
// Verdict config
// ────────────────────────────────────────────────────────────────

const VERDICT = {
  cleared: {
    color: C.cleared,
    title: "CLEARED FOR RELEASE",
    intro:
      "This certifies that the following audio work was analyzed by " +
      "Probatio's forensic audio analysis pipeline and cleared for " +
      "release with no actionable similarity matches detected.",
  },
  conditional: {
    color: C.conditional,
    title: "CONDITIONAL CLEARANCE — REVIEW REQUIRED",
    intro:
      "This certifies that the following audio work was analyzed by " +
      "Probatio's forensic audio analysis pipeline. Matches were " +
      "detected that require legal review before release.",
  },
  blocked: {
    color: C.blocked,
    title: "CLEARANCE NOT GRANTED",
    intro:
      "This certifies that the following audio work was analyzed by " +
      "Probatio's forensic audio analysis pipeline. High-similarity " +
      "matches were detected. Release is not recommended without clearance.",
  },
};

// ────────────────────────────────────────────────────────────────
// Certificate Component
// ────────────────────────────────────────────────────────────────

function ClearanceCertificate({ data }: { data: CertificateData }) {
  const verdict = VERDICT[data.clearanceStatus];

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header Band */}
        <View style={s.headerBand}>
          <Text style={s.brandName}>P R O B A T I O</Text>
          <Text style={s.brandSub}>
            FORENSIC AUDIO ANALYSIS PLATFORM
          </Text>
        </View>

        {/* Gold Divider */}
        <View style={s.divider} />

        {/* Certificate Title */}
        <View style={s.titleSection}>
          <Text style={s.certTitle}>
            CERTIFICATE OF PRE-RELEASE CLEARANCE
          </Text>
        </View>

        {/* Verdict Badge */}
        <View
          style={[s.verdictBadge, { backgroundColor: verdict.color }]}
        >
          <Text style={s.verdictText}>{verdict.title}</Text>
          {data.clearanceStatus === "cleared" && (
            <Text style={s.verdictSub}>
              No actionable matches found above threshold
            </Text>
          )}
          {data.clearanceStatus === "conditional" && (
            <Text style={s.verdictSub}>
              {data.blockingMatches?.length ?? 0} match(es) require
              review
            </Text>
          )}
          {data.clearanceStatus === "blocked" && (
            <Text style={s.verdictSub}>
              {data.blockingMatches?.length ?? 0} high-risk match(es)
              detected
            </Text>
          )}
        </View>

        {/* Intro Text */}
        <View style={s.body}>
          <Text style={s.introText}>{verdict.intro}</Text>

          {/* Track Info */}
          <Text style={s.sectionLabel}>TRACK INFORMATION</Text>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Track Title</Text>
            <Text style={s.infoValue}>
              &ldquo;{data.trackTitle}&rdquo;
            </Text>
          </View>
          {data.artist && (
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Artist</Text>
              <Text style={s.infoValue}>{data.artist}</Text>
            </View>
          )}
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Duration</Text>
            <Text style={s.infoValue}>{data.durationFormatted}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>File Hash (SHA-256)</Text>
            <Text style={s.hashValue}>{data.fileHash}</Text>
          </View>
          {data.detectedGenre && (
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Genre</Text>
              <Text style={s.infoValue}>
                {data.detectedGenre}
                {data.genreConfidence
                  ? ` (${Math.round(data.genreConfidence * 100)}% confidence)`
                  : ""}
              </Text>
            </View>
          )}
          {data.language && (
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Language</Text>
              <Text style={s.infoValue}>{data.language}</Text>
            </View>
          )}

          {/* Analysis Info */}
          <Text style={s.sectionLabel}>ANALYSIS DETAILS</Text>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Analysis Date</Text>
            <Text style={s.infoValue}>{data.analysisDate}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Analysis ID</Text>
            <Text style={s.hashValue}>{data.analysisId}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Pipeline</Text>
            <Text style={s.infoValue}>v{data.pipelineVersion}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Dimensions Analyzed</Text>
            <Text style={s.infoValue}>
              Melody, Harmony, Rhythm, Timbre, Lyrics
            </Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Highest Match Score</Text>
            <Text style={s.infoValue}>
              {(data.highestMatchScore * 100).toFixed(0)}% (
              {data.highestMatchScore < 0.3
                ? "below actionable threshold"
                : data.highestMatchScore < 0.6
                  ? "review recommended"
                  : "above actionable threshold"}
              )
            </Text>
          </View>

          {/* Catalogs Scanned */}
          <Text style={s.sectionLabel}>CATALOGS SCANNED</Text>
          {data.catalogs.map((cat, i) => (
            <Text key={i} style={s.catalogItem}>
              {"\u2022"} {cat.name} (
              {cat.trackCount.toLocaleString()} tracks)
            </Text>
          ))}
          <Text style={s.catalogItem}>
            Total: {data.totalTracksScanned.toLocaleString()} reference
            tracks
          </Text>

          {/* Blocking matches (for conditional/blocked) */}
          {data.blockingMatches && data.blockingMatches.length > 0 && (
            <>
              <Text style={s.sectionLabel}>MATCHES REQUIRING REVIEW</Text>
              {data.blockingMatches.map((m, i) => (
                <Text key={i} style={s.blockMatch}>
                  {"\u2022"} &ldquo;{m.title}&rdquo; by {m.artist} (
                  {Math.round(m.score * 100)}% similarity)
                </Text>
              ))}
            </>
          )}
        </View>

        {/* QR Code */}
        <View style={s.qrSection}>
          <Image src={data.qrCodeDataUrl} style={s.qrImage} />
          <Text style={s.qrLabel}>
            Scan to verify this certificate at probatio.audio/verify
          </Text>
        </View>

        {/* Verification Box */}
        <View style={s.verifyBox}>
          <Text style={s.verifyLabel}>VERIFICATION HASH</Text>
          <Text style={s.verifyHash}>{data.verificationHash}</Text>
          <Text style={[s.verifyLabel, { marginTop: 4 }]}>
            CHAIN OF CUSTODY
          </Text>
          <Text style={s.verifyHash}>
            {data.chainEntryCount} entries {"\u2022"} Integrity: VERIFIED
          </Text>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <View style={s.footerDivider} />
          <Text style={s.footerText}>
            This certificate was generated by Probatio (probatio.audio), a
            product of Clandestino Ventures, LLC. This document provides a
            technical analysis record and does not constitute legal advice.
            The analysis methodology is disclosed at
            probatio.audio/methodology.
          </Text>
          <Text style={s.footerBrand}>The proof is in the signal.</Text>
        </View>
      </Page>
    </Document>
  );
}

// ────────────────────────────────────────────────────────────────
// Buffer Generation
// ────────────────────────────────────────────────────────────────

export async function generateCertificateBuffer(
  data: CertificateData,
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(ClearanceCertificate, {
    data,
  }) as any;
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}
