// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Chain of Custody
 *
 * Cryptographic hashing and audit trail functions for maintaining
 * evidence integrity throughout the forensic analysis lifecycle.
 * Uses the Web Crypto API (available in Node 18+ and all modern browsers).
 */

import type { ChainOfCustodyEntry } from "@/types/forensic";

// ────────────────────────────────────────────────────────────────────────────
// SHA-256 Hashing
// ────────────────────────────────────────────────────────────────────────────

/**
 * Compute the SHA-256 hash of an {@link ArrayBuffer} using the Web Crypto API.
 *
 * @param data  Raw binary data to hash.
 * @returns Hex-encoded SHA-256 digest (64 characters).
 */
export async function computeSHA256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compute the SHA-256 hash of a string (UTF-8 encoded).
 *
 * @param input  String to hash.
 * @returns Hex-encoded SHA-256 digest.
 */
export async function computeStringSHA256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  return computeSHA256(encoder.encode(input).buffer as ArrayBuffer);
}

// ────────────────────────────────────────────────────────────────────────────
// File Hashing
// ────────────────────────────────────────────────────────────────────────────

/**
 * Compute the SHA-256 hash of a {@link File} object.
 *
 * Reads the entire file into memory. For very large files in a
 * server context, prefer streaming with Node's `crypto` module.
 *
 * @param file  The File (or Blob) to hash.
 * @returns Hex-encoded SHA-256 digest.
 */
export async function computeFileHash(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  return computeSHA256(buffer);
}

// ────────────────────────────────────────────────────────────────────────────
// Audit Entries
// ────────────────────────────────────────────────────────────────────────────

/**
 * Create a new chain-of-custody audit entry.
 *
 * @param params.sequence     Monotonically increasing sequence number.
 * @param params.actor        User ID or system identifier.
 * @param params.action       Human-readable description of the action.
 * @param params.hashAfter    SHA-256 hash of the entity after the action.
 * @param params.hashBefore   SHA-256 hash of the entity before the action (null for first entry).
 * @param params.ipAddress    IP address of the actor (null for system actions).
 * @param params.metadata     Additional context.
 * @returns A fully populated {@link ChainOfCustodyEntry}.
 */
export function createAuditEntry(params: {
  sequence: number;
  actor: string;
  action: string;
  hashAfter: string;
  hashBefore: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
}): ChainOfCustodyEntry {
  return {
    sequence: params.sequence,
    timestamp: new Date().toISOString(),
    actor: params.actor,
    action: params.action,
    hashAfter: params.hashAfter,
    hashBefore: params.hashBefore,
    ipAddress: params.ipAddress ?? null,
    metadata: params.metadata ?? null,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Chain Verification
// ────────────────────────────────────────────────────────────────────────────

/** Result of a chain-of-custody verification. */
export interface ChainVerificationResult {
  /** Whether the entire chain is valid. */
  valid: boolean;
  /** Total number of entries in the chain. */
  totalEntries: number;
  /** Index of the first broken link (-1 if chain is valid). */
  brokenAtIndex: number;
  /** Human-readable error message (null if valid). */
  error: string | null;
}

/**
 * Verify the integrity of a chain-of-custody log.
 *
 * Checks that:
 * 1. Sequence numbers are monotonically increasing starting from 0 (or 1).
 * 2. Each entry's `hashBefore` matches the previous entry's `hashAfter`.
 * 3. The first entry has `hashBefore === null`.
 * 4. No entries are missing.
 *
 * @param chain  Ordered array of custody entries.
 * @returns A {@link ChainVerificationResult} describing the outcome.
 */
export function verifyChain(
  chain: readonly ChainOfCustodyEntry[],
): ChainVerificationResult {
  if (chain.length === 0) {
    return {
      valid: true,
      totalEntries: 0,
      brokenAtIndex: -1,
      error: null,
    };
  }

  // First entry must have no predecessor hash.
  if (chain[0].hashBefore !== null) {
    return {
      valid: false,
      totalEntries: chain.length,
      brokenAtIndex: 0,
      error:
        "First entry must have hashBefore === null, " +
        `but found "${chain[0].hashBefore}"`,
    };
  }

  for (let i = 1; i < chain.length; i++) {
    const previous = chain[i - 1];
    const current = chain[i];

    // Sequence must be strictly increasing.
    if (current.sequence <= previous.sequence) {
      return {
        valid: false,
        totalEntries: chain.length,
        brokenAtIndex: i,
        error:
          `Sequence must be strictly increasing: entry[${i}].sequence ` +
          `(${current.sequence}) <= entry[${i - 1}].sequence (${previous.sequence})`,
      };
    }

    // Hash chain: current.hashBefore must equal previous.hashAfter.
    if (current.hashBefore !== previous.hashAfter) {
      return {
        valid: false,
        totalEntries: chain.length,
        brokenAtIndex: i,
        error:
          `Broken hash chain at entry[${i}]: expected hashBefore ` +
          `"${previous.hashAfter}", got "${current.hashBefore}"`,
      };
    }
  }

  return {
    valid: true,
    totalEntries: chain.length,
    brokenAtIndex: -1,
    error: null,
  };
}
