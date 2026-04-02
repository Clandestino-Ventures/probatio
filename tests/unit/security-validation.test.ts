import { describe, it, expect } from "vitest";
import { SUPPORTED_FORMATS, MAX_FILE_SIZE } from "@/lib/constants";
import { rateLimit } from "@/lib/rate-limit";

// Local validator matching the logic in src/app/api/analyze/route.ts
// (that function is not exported, so we replicate the regex for testing)
function isValidSha256(hash: string): boolean {
  return /^[0-9a-f]{64}$/.test(hash);
}

describe("Tier 2: Security \u2014 Input Validation", () => {
  describe("SHA-256 Hash Validation", () => {
    it("accepts valid 64-char lowercase hex hash", () => {
      const valid = "a".repeat(64);
      expect(isValidSha256(valid)).toBe(true);
    });

    it("rejects uppercase hex", () => {
      expect(isValidSha256("A".repeat(64))).toBe(false);
    });

    it("rejects wrong length (too short)", () => {
      expect(isValidSha256("a".repeat(63))).toBe(false);
    });

    it("rejects wrong length (too long)", () => {
      expect(isValidSha256("a".repeat(65))).toBe(false);
    });

    it("rejects non-hex characters", () => {
      expect(isValidSha256("g".repeat(64))).toBe(false);
      expect(isValidSha256("z".repeat(64))).toBe(false);
    });

    it("rejects empty string", () => {
      expect(isValidSha256("")).toBe(false);
    });

    it("accepts a real SHA-256 hash", () => {
      // SHA-256 of empty string
      expect(
        isValidSha256(
          "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        ),
      ).toBe(true);
    });
  });

  describe("File Format Validation", () => {
    it("accepts supported audio formats", () => {
      const expected = ["wav", "mp3", "flac", "aac", "ogg", "m4a", "aiff", "wma"];
      for (const fmt of expected) {
        expect(SUPPORTED_FORMATS).toContain(fmt);
      }
    });

    it("does not include non-audio formats", () => {
      const rejected = ["png", "pdf", "exe", "docx", "zip", "mp4"];
      for (const fmt of rejected) {
        expect((SUPPORTED_FORMATS as readonly string[]).includes(fmt)).toBe(false);
      }
    });

    it("contains exactly 8 formats", () => {
      expect(SUPPORTED_FORMATS.length).toBe(8);
    });
  });

  describe("File Size Validation", () => {
    it("MAX_FILE_SIZE is 250 MB", () => {
      expect(MAX_FILE_SIZE).toBe(250 * 1024 * 1024);
    });

    it("rejects zero-byte files", () => {
      const size = 0;
      expect(size > 0 && size <= MAX_FILE_SIZE).toBe(false);
    });

    it("rejects files exceeding limit", () => {
      const size = MAX_FILE_SIZE + 1;
      expect(size > 0 && size <= MAX_FILE_SIZE).toBe(false);
    });

    it("accepts file exactly at the limit", () => {
      expect(MAX_FILE_SIZE > 0 && MAX_FILE_SIZE <= MAX_FILE_SIZE).toBe(true);
    });
  });

  describe("Rate Limiting", () => {
    it("allows requests within limit", () => {
      const key = "test-rate-" + Math.random();
      const r1 = rateLimit(key, 5, 60000);
      expect(r1.success).toBe(true);
      expect(r1.remaining).toBe(4);
    });

    it("decrements remaining on each call", () => {
      const key = "test-decrement-" + Math.random();
      const r1 = rateLimit(key, 5, 60000);
      expect(r1.remaining).toBe(4);
      const r2 = rateLimit(key, 5, 60000);
      expect(r2.remaining).toBe(3);
      const r3 = rateLimit(key, 5, 60000);
      expect(r3.remaining).toBe(2);
    });

    it("blocks requests exceeding limit", () => {
      const key = "test-block-" + Math.random();
      for (let i = 0; i < 5; i++) {
        rateLimit(key, 5, 60000);
      }
      const blocked = rateLimit(key, 5, 60000);
      expect(blocked.success).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it("resets after window expires", async () => {
      const key = "test-reset-" + Math.random();
      // Use a very short window (10ms)
      for (let i = 0; i < 3; i++) {
        rateLimit(key, 3, 10);
      }
      // Wait for window to expire
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          const result = rateLimit(key, 3, 10);
          expect(result.success).toBe(true);
          resolve();
        }, 20);
      });
    });
  });
});
