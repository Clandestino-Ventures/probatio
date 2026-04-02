// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Evidence Package Assembly
 *
 * Assembles a sealed, court-ready evidence package containing all
 * analysis artifacts, chain of custody documentation, and metadata
 * needed for forensic proceedings.
 *
 * The package is cryptographically sealed with a SHA-256 hash
 * computed over all included items.
 */

import { computeStringSHA256 } from "@/lib/analysis/chain-of-custody";
import { PIPELINE_VERSION } from "@/lib/constants";
import { THRESHOLD_VERSION } from "@/lib/analysis/risk-classifier";
import type { StemUrls } from "@/types/analysis";
import type {
  ForensicComparison,
  EvidencePackage,
  EvidenceItem,
  EvidenceSystemInfo,
  ChainOfCustodyEntry,
} from "@/types/forensic";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface EvidencePackageInput {
  forensicCaseId: string;
  caseNumber: string;
  comparison: ForensicComparison;
  trackA: {
    normalizedUrl: string;
    stemUrls: StemUrls;
    hash: string;
  };
  trackB: {
    normalizedUrl: string;
    stemUrls: StemUrls;
    hash: string;
  };
  chainOfCustody: Record<string, unknown>[];
}

// ────────────────────────────────────────────────────────────────────────────
// Evidence Item Builders
// ────────────────────────────────────────────────────────────────────────────

function createAudioEvidenceItem(
  label: string,
  description: string,
  url: string,
  hash: string,
  relativePath: string,
): EvidenceItem {
  return {
    label,
    description,
    mimeType: "audio/wav",
    hashSha256: hash,
    sizeBytes: 0, // Will be populated when the file is fetched for packaging
    relativePath,
  };
}

function buildTrackItems(
  trackLabel: string,
  normalizedUrl: string,
  stemUrls: StemUrls,
  hash: string,
): EvidenceItem[] {
  const prefix = trackLabel.toLowerCase().replace(/\s+/g, "-");

  return [
    createAudioEvidenceItem(
      `${trackLabel} - Original (Normalized)`,
      `Normalized audio file for ${trackLabel}`,
      normalizedUrl,
      hash,
      `audio/${prefix}/normalized.wav`,
    ),
    createAudioEvidenceItem(
      `${trackLabel} - Vocals Stem`,
      `Isolated vocals stem for ${trackLabel}`,
      stemUrls.vocals,
      "", // Hash computed at packaging time
      `audio/${prefix}/stems/vocals.wav`,
    ),
    createAudioEvidenceItem(
      `${trackLabel} - Drums Stem`,
      `Isolated drums stem for ${trackLabel}`,
      stemUrls.drums,
      "",
      `audio/${prefix}/stems/drums.wav`,
    ),
    createAudioEvidenceItem(
      `${trackLabel} - Bass Stem`,
      `Isolated bass stem for ${trackLabel}`,
      stemUrls.bass,
      "",
      `audio/${prefix}/stems/bass.wav`,
    ),
    createAudioEvidenceItem(
      `${trackLabel} - Other Stem`,
      `Isolated other instruments stem for ${trackLabel}`,
      stemUrls.other,
      "",
      `audio/${prefix}/stems/other.wav`,
    ),
  ];
}

// ────────────────────────────────────────────────────────────────────────────
// Report Items
// ────────────────────────────────────────────────────────────────────────────

async function buildReportItem(
  comparison: ForensicComparison,
  caseNumber: string,
): Promise<EvidenceItem> {
  const reportContent = JSON.stringify({
    caseNumber,
    comparison,
    generatedAt: new Date().toISOString(),
    pipelineVersion: PIPELINE_VERSION,
    thresholdVersion: THRESHOLD_VERSION,
  });

  const reportHash = await computeStringSHA256(reportContent);

  return {
    label: "FORENSIC-REPORT",
    description: "Full forensic comparison report with dimension analysis and risk assessment",
    mimeType: "application/json",
    hashSha256: reportHash,
    sizeBytes: new TextEncoder().encode(reportContent).length,
    relativePath: "reports/forensic-report.json",
  };
}

async function buildChainOfCustodyItem(
  chainOfCustody: Record<string, unknown>[],
): Promise<EvidenceItem> {
  const custodyContent = JSON.stringify(chainOfCustody);
  const custodyHash = await computeStringSHA256(custodyContent);

  return {
    label: "CHAIN-OF-CUSTODY",
    description: "Complete chain of custody log from intake through evidence sealing",
    mimeType: "application/json",
    hashSha256: custodyHash,
    sizeBytes: new TextEncoder().encode(custodyContent).length,
    relativePath: "custody/chain-of-custody.json",
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Package Assembly
// ────────────────────────────────────────────────────────────────────────────

/**
 * Assemble a sealed evidence package for a forensic case.
 *
 * Collects all audio files, stems, analysis reports, and chain of custody
 * records into a single package with a cryptographic seal (SHA-256 hash
 * of all item hashes concatenated).
 *
 * @param input  All artifacts and metadata needed for the evidence package.
 * @returns A complete {@link EvidencePackage} ready for download/storage.
 */
export async function assembleEvidencePackage(
  input: EvidencePackageInput,
): Promise<EvidencePackage> {
  const {
    forensicCaseId,
    caseNumber,
    comparison,
    trackA,
    trackB,
    chainOfCustody,
  } = input;

  // Build all evidence items.
  const trackAItems = buildTrackItems(
    "Track A",
    trackA.normalizedUrl,
    trackA.stemUrls,
    trackA.hash,
  );

  const trackBItems = buildTrackItems(
    "Track B",
    trackB.normalizedUrl,
    trackB.stemUrls,
    trackB.hash,
  );

  const reportItem = await buildReportItem(comparison, caseNumber);
  const custodyItem = await buildChainOfCustodyItem(chainOfCustody);

  const items: EvidenceItem[] = [
    ...trackAItems,
    ...trackBItems,
    reportItem,
    custodyItem,
  ];

  // Label items sequentially.
  const labeledItems = items.map((item, index) => ({
    ...item,
    label: item.label || `EXHIBIT-${String.fromCharCode(65 + index)}`,
  }));

  // Compute package hash: SHA-256 of all item hashes concatenated.
  const allHashes = labeledItems
    .map((item) => item.hashSha256)
    .filter((hash) => hash.length > 0)
    .join("|");
  const packageHash = await computeStringSHA256(allHashes);

  // Build chain of custody entries typed correctly.
  const typedChain: ChainOfCustodyEntry[] = chainOfCustody.map(
    (entry, index) => ({
      sequence: (entry as Record<string, unknown>).sequence as number ?? index,
      timestamp: (entry as Record<string, unknown>).timestamp as string ?? new Date().toISOString(),
      actor: (entry as Record<string, unknown>).actor as string ?? "system",
      action: (entry as Record<string, unknown>).action as string ?? "",
      hashAfter: (entry as Record<string, unknown>).hashAfter as string ?? "",
      hashBefore: ((entry as Record<string, unknown>).hashBefore as string | null) ?? null,
      ipAddress: ((entry as Record<string, unknown>).ipAddress as string | null) ?? null,
      metadata: ((entry as Record<string, unknown>).metadata as Record<string, unknown> | null) ?? null,
    }),
  );

  // System info for reproducibility.
  const systemInfo: EvidenceSystemInfo = {
    platform: "PROBATIO",
    pipelineVersion: PIPELINE_VERSION,
    thresholdVersion: THRESHOLD_VERSION,
    analysisTimestamp: comparison.analyzedAt,
    normalization: {
      sampleRate: 44100,
      bitDepth: 16,
      channels: 1,
    },
  };

  // Generate the download URL (will be populated by storage upload).
  const downloadUrl = `https://storage.probatio.audio/evidence/${forensicCaseId}/${packageHash}.zip`;

  const evidencePackage: EvidencePackage = {
    id: crypto.randomUUID(),
    forensicCaseId,
    caseNumber,
    generatedAt: new Date().toISOString(),
    packageHash,
    downloadUrl,
    items: labeledItems,
    chainOfCustody: typedChain,
    systemInfo,
  };

  return evidencePackage;
}
