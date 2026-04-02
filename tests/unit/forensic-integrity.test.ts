import { describe, it, expect } from "vitest";
import {
  computeStringSHA256,
  verifyChain,
} from "@/lib/analysis/chain-of-custody";
import { classifyRiskFromScore } from "@/lib/comparison/scoring";
import type { ChainOfCustodyEntry } from "@/types/forensic";

// Helper to build a mock chain-of-custody entry
function mockEntry(
  overrides: Partial<ChainOfCustodyEntry> & Pick<ChainOfCustodyEntry, "sequence" | "hashBefore" | "hashAfter">,
): ChainOfCustodyEntry {
  return {
    timestamp: new Date().toISOString(),
    actor: "system",
    action: "test-action",
    ipAddress: null,
    metadata: null,
    ...overrides,
  };
}

describe("Tier 1: Forensic Integrity", () => {
  describe("Hash Determinism", () => {
    it("computeStringSHA256 produces consistent hash for same input", async () => {
      const hash1 = await computeStringSHA256("forensic evidence");
      const hash2 = await computeStringSHA256("forensic evidence");
      expect(hash1).toBe(hash2);
    });

    it("computeStringSHA256 produces different hash for different input", async () => {
      const hash1 = await computeStringSHA256("hello");
      const hash2 = await computeStringSHA256("world");
      expect(hash1).not.toBe(hash2);
    });

    it("hash output is 64-char lowercase hex", async () => {
      const hash = await computeStringSHA256("test data");
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("empty string has a valid hash", async () => {
      const hash = await computeStringSHA256("");
      // SHA-256 of empty string is a well-known constant
      expect(hash).toBe(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      );
    });

    it("hash of unicode (Spanish) text is consistent", async () => {
      const text = "analisis forense de audio \u2014 cadena de custodia";
      const hash1 = await computeStringSHA256(text);
      const hash2 = await computeStringSHA256(text);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("Risk Classification Determinism", () => {
    it("classifies scores deterministically at every threshold", () => {
      // classifyRiskFromScore boundaries (from scoring.ts):
      // clear:    score <= 0.10
      // low:      0.10 < score < 0.30
      // moderate: 0.30 <= score < 0.60
      // high:     0.60 <= score < 0.85
      // critical: score >= 0.85
      expect(classifyRiskFromScore(0.0)).toBe("clear");
      expect(classifyRiskFromScore(0.10)).toBe("clear");
      expect(classifyRiskFromScore(0.11)).toBe("low");
      expect(classifyRiskFromScore(0.29)).toBe("low");
      expect(classifyRiskFromScore(0.30)).toBe("moderate");
      expect(classifyRiskFromScore(0.59)).toBe("moderate");
      expect(classifyRiskFromScore(0.60)).toBe("high");
      expect(classifyRiskFromScore(0.84)).toBe("high");
      expect(classifyRiskFromScore(0.85)).toBe("critical");
      expect(classifyRiskFromScore(1.0)).toBe("critical");
    });

    it("same input always produces same classification (100 runs)", () => {
      for (let i = 0; i < 100; i++) {
        expect(classifyRiskFromScore(0.72)).toBe("high");
      }
    });

    it("boundary value 0.85 is always critical", () => {
      // The line between "high" and "critical" — must be deterministic
      for (let i = 0; i < 50; i++) {
        expect(classifyRiskFromScore(0.85)).toBe("critical");
        expect(classifyRiskFromScore(0.8499)).toBe("high");
      }
    });
  });

  describe("Chain of Custody Logic", () => {
    it("verifyChain validates a correct chain", () => {
      const chain: ChainOfCustodyEntry[] = [
        mockEntry({ sequence: 0, hashBefore: null, hashAfter: "abc123" }),
        mockEntry({ sequence: 1, hashBefore: "abc123", hashAfter: "def456" }),
        mockEntry({ sequence: 2, hashBefore: "def456", hashAfter: "ghi789" }),
      ];
      const result = verifyChain(chain);
      expect(result.valid).toBe(true);
      expect(result.brokenAtIndex).toBe(-1);
      expect(result.error).toBeNull();
      expect(result.totalEntries).toBe(3);
    });

    it("verifyChain detects broken hash link", () => {
      const chain: ChainOfCustodyEntry[] = [
        mockEntry({ sequence: 0, hashBefore: null, hashAfter: "abc123" }),
        mockEntry({
          sequence: 1,
          hashBefore: "WRONG_HASH",
          hashAfter: "def456",
        }),
        mockEntry({ sequence: 2, hashBefore: "def456", hashAfter: "ghi789" }),
      ];
      const result = verifyChain(chain);
      expect(result.valid).toBe(false);
      expect(result.brokenAtIndex).toBe(1);
      expect(result.error).toContain("Broken hash chain");
    });

    it("verifyChain detects out-of-sequence entries", () => {
      // Sequence 0, 0, 1 — entry[1].sequence (0) <= entry[0].sequence (0)
      const chain: ChainOfCustodyEntry[] = [
        mockEntry({ sequence: 0, hashBefore: null, hashAfter: "abc123" }),
        mockEntry({ sequence: 0, hashBefore: "abc123", hashAfter: "def456" }),
        mockEntry({ sequence: 1, hashBefore: "def456", hashAfter: "ghi789" }),
      ];
      const result = verifyChain(chain);
      expect(result.valid).toBe(false);
      expect(result.brokenAtIndex).toBe(1);
      expect(result.error).toContain("Sequence must be strictly increasing");
    });

    it("verifyChain handles single-entry chain", () => {
      const chain: ChainOfCustodyEntry[] = [
        mockEntry({ sequence: 0, hashBefore: null, hashAfter: "abc123" }),
      ];
      const result = verifyChain(chain);
      expect(result.valid).toBe(true);
      expect(result.totalEntries).toBe(1);
    });

    it("verifyChain handles empty chain", () => {
      const result = verifyChain([]);
      expect(result.valid).toBe(true);
      expect(result.totalEntries).toBe(0);
    });

    it("verifyChain rejects first entry with non-null hashBefore", () => {
      const chain: ChainOfCustodyEntry[] = [
        mockEntry({
          sequence: 0,
          hashBefore: "should-be-null",
          hashAfter: "abc123",
        }),
      ];
      const result = verifyChain(chain);
      expect(result.valid).toBe(false);
      expect(result.brokenAtIndex).toBe(0);
      expect(result.error).toContain("hashBefore === null");
    });
  });
});
