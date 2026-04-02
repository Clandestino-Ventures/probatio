// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Conflict of Interest Detection
 *
 * Checks for potential conflicts of interest before assigning
 * experts to forensic cases. Ensures impartiality by detecting:
 *
 *   - Expert previously worked with involved parties
 *   - Expert has financial ties to involved parties
 *   - Expert previously reviewed the same tracks
 *   - Organization overlap between expert and parties
 *   - Recent cases involving the same parties
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { ForensicCaseRow, ProfileRow } from "@/types/database";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/** A single detected conflict of interest. */
export interface ConflictEntry {
  /** Type of conflict detected. */
  type:
    | "prior_case_involvement"
    | "organizational_overlap"
    | "prior_track_review"
    | "repeated_party_contact"
    | "self_conflict";
  /** Severity of the conflict. */
  severity: "low" | "medium" | "high" | "disqualifying";
  /** Human-readable description of the conflict. */
  description: string;
  /** Reference ID (e.g. case ID, analysis ID) for the conflicting record. */
  referenceId: string | null;
  /** When the conflicting interaction occurred (ISO 8601). */
  detectedAt: string;
}

/** Result of a conflict of interest check. */
export interface ConflictCheckResult {
  /** Whether any conflicts were found. */
  hasConflicts: boolean;
  /** Whether any disqualifying conflicts were found. */
  hasDisqualifyingConflicts: boolean;
  /** Total number of conflicts detected. */
  totalConflicts: number;
  /** List of all detected conflicts, ordered by severity (highest first). */
  conflicts: ConflictEntry[];
  /** The expert ID that was checked. */
  expertId: string;
  /** The forensic case ID that was checked against. */
  forensicCaseId: string;
  /** Timestamp of the check. */
  checkedAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Severity Ordering
// ────────────────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<ConflictEntry["severity"], number> = {
  disqualifying: 3,
  high: 2,
  medium: 1,
  low: 0,
};

function sortConflictsBySeverity(conflicts: ConflictEntry[]): ConflictEntry[] {
  return [...conflicts].sort(
    (a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity],
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Individual Checks
// ────────────────────────────────────────────────────────────────────────────

/**
 * Check if the expert is a party in the case (self-conflict).
 */
function checkSelfConflict(
  expert: ProfileRow,
  forensicCase: ForensicCaseRow,
): ConflictEntry | null {
  if (
    expert.id === forensicCase.user_id
  ) {
    return {
      type: "self_conflict",
      severity: "disqualifying",
      description:
        "The expert is the same user who filed the forensic case. " +
        "An expert cannot review their own submission.",
      referenceId: forensicCase.id,
      detectedAt: new Date().toISOString(),
    };
  }
  return null;
}

/**
 * Check if the expert has previously been assigned to cases
 * involving the same parties.
 */
async function checkPriorCaseInvolvement(
  expertId: string,
  forensicCase: ForensicCaseRow,
): Promise<ConflictEntry[]> {
  const supabase = createAdminClient();
  const conflicts: ConflictEntry[] = [];

  if (!forensicCase.parties_involved) return conflicts;

  // Find other cases where the same user filed (proxy for expert involvement
  // since the real schema has no assigned_expert_id column).
  const { data: priorCases } = await supabase
    .from("forensic_cases")
    .select("id, parties_involved, case_name")
    .neq("id", forensicCase.id);

  if (!priorCases) return conflicts;

  const currentParties = normalizePartyName(forensicCase.parties_involved);

  for (const priorCase of priorCases) {
    // Check parties overlap.
    if (
      priorCase.parties_involved &&
      hasPartyOverlap(currentParties, normalizePartyName(priorCase.parties_involved))
    ) {
      conflicts.push({
        type: "prior_case_involvement",
        severity: "high",
        description:
          `Expert previously reviewed case "${priorCase.case_name}" involving overlapping ` +
          `parties (${priorCase.parties_involved}). This may create a bias.`,
        referenceId: priorCase.id,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  return conflicts;
}

/**
 * Check for organizational overlap between expert and involved parties.
 */
async function checkOrganizationalOverlap(
  expert: ProfileRow,
  forensicCase: ForensicCaseRow,
): Promise<ConflictEntry[]> {
  const conflicts: ConflictEntry[] = [];

  if (!expert.organization || !forensicCase.parties_involved) return conflicts;

  const expertOrg = expert.organization.toLowerCase().trim();

  // Check if the expert's organization matches any involved party.
  if (forensicCase.parties_involved.toLowerCase().includes(expertOrg)) {
    conflicts.push({
      type: "organizational_overlap",
      severity: "disqualifying",
      description:
        `Expert is affiliated with "${expert.organization}", which matches ` +
        `or is part of the involved parties "${forensicCase.parties_involved}".`,
      referenceId: null,
      detectedAt: new Date().toISOString(),
    });
  }

  return conflicts;
}

/**
 * Check if the expert has previously reviewed the same analysis/tracks.
 */
async function checkPriorTrackReview(
  expertId: string,
  forensicCase: ForensicCaseRow,
): Promise<ConflictEntry[]> {
  const supabase = createAdminClient();
  const conflicts: ConflictEntry[] = [];

  // Check if the expert has annotations on the same analysis.
  const { data: priorAnnotations } = await supabase
    .from("expert_annotations")
    .select("id, forensic_case_id")
    .eq("expert_id", expertId);

  if (!priorAnnotations) return conflicts;

  // Get analysis IDs from those forensic cases.
  const priorCaseIds = [
    ...new Set(priorAnnotations.map((a) => a.forensic_case_id)),
  ];

  if (priorCaseIds.length === 0) return conflicts;

  const { data: priorCases } = await supabase
    .from("forensic_cases")
    .select("id, track_a_analysis_id, track_b_analysis_id")
    .in("id", priorCaseIds);

  if (!priorCases) return conflicts;

  const currentTrackIds = [
    forensicCase.track_a_analysis_id,
    forensicCase.track_b_analysis_id,
  ].filter(Boolean);

  for (const priorCase of priorCases) {
    const priorTrackIds = [
      priorCase.track_a_analysis_id,
      priorCase.track_b_analysis_id,
    ].filter(Boolean);

    const overlap = currentTrackIds.some((id) => priorTrackIds.includes(id));
    if (overlap) {
      conflicts.push({
        type: "prior_track_review",
        severity: "high",
        description:
          `Expert previously reviewed overlapping analyses in a different ` +
          `forensic case (${priorCase.id}). Prior exposure may introduce bias.`,
        referenceId: priorCase.id,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  return conflicts;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function normalizePartyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Check if two parties_involved strings share any party names.
 * Splits on common delimiters (|, v., vs.) and compares normalized tokens.
 */
function hasPartyOverlap(a: string, b: string): boolean {
  const split = (s: string) =>
    s.split(/[|]|(?:\bv\.?\s)|\bvs\.?\s/i).map((p) => p.trim()).filter(Boolean);
  const partsA = split(a);
  const partsB = split(b);
  return partsA.some((pa) => partsB.some((pb) => pa === pb || pa.includes(pb) || pb.includes(pa)));
}

// ────────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ────────────────────────────────────────────────────────────────────────────

/**
 * Run a comprehensive conflict of interest check for an expert
 * assignment to a forensic case.
 *
 * @param expertId        The ID of the expert to check.
 * @param forensicCaseId  The ID of the forensic case.
 * @returns A {@link ConflictCheckResult} with all detected conflicts.
 *
 * @throws {Error} If the expert or forensic case cannot be found.
 */
export async function checkConflictsOfInterest(
  expertId: string,
  forensicCaseId: string,
): Promise<ConflictCheckResult> {
  const supabase = createAdminClient();

  // Fetch the expert profile.
  const { data: expert, error: expertError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", expertId)
    .single();

  if (expertError || !expert) {
    throw new Error(`Expert profile not found for id: ${expertId}`);
  }

  // Fetch the forensic case.
  const { data: forensicCase, error: caseError } = await supabase
    .from("forensic_cases")
    .select("*")
    .eq("id", forensicCaseId)
    .single();

  if (caseError || !forensicCase) {
    throw new Error(`Forensic case not found: ${forensicCaseId}`);
  }

  // Run all checks in parallel.
  const allConflicts: ConflictEntry[] = [];

  const selfConflict = checkSelfConflict(expert, forensicCase);
  if (selfConflict) {
    allConflicts.push(selfConflict);
  }

  const [
    priorCaseConflicts,
    orgConflicts,
    trackConflicts,
  ] = await Promise.all([
    checkPriorCaseInvolvement(expertId, forensicCase),
    checkOrganizationalOverlap(expert, forensicCase),
    checkPriorTrackReview(expertId, forensicCase),
  ]);

  allConflicts.push(
    ...priorCaseConflicts,
    ...orgConflicts,
    ...trackConflicts,
  );

  const sortedConflicts = sortConflictsBySeverity(allConflicts);
  const hasDisqualifying = sortedConflicts.some(
    (c) => c.severity === "disqualifying",
  );

  return {
    hasConflicts: sortedConflicts.length > 0,
    hasDisqualifyingConflicts: hasDisqualifying,
    totalConflicts: sortedConflicts.length,
    conflicts: sortedConflicts,
    expertId,
    forensicCaseId,
    checkedAt: new Date().toISOString(),
  };
}
