import { describe, it, expect } from "vitest";
import { formatDuration, formatFileSize, formatHash, formatPercent, formatRelativeTime } from "@/lib/format";
import { downsample } from "@/lib/storage";
import { RISK_CONFIG, DIMENSION_COLORS, getRiskConfig } from "@/lib/config/risk-config";

describe("Tier 5: Application Utils", () => {

  describe("Format Utilities", () => {
    it("formatDuration handles zero", () => {
      expect(formatDuration(0)).toBe("0:00");
    });

    it("formatDuration formats mm:ss", () => {
      expect(formatDuration(62)).toBe("1:02");
      expect(formatDuration(222)).toBe("3:42");
    });

    it("formatDuration handles hour+", () => {
      expect(formatDuration(3661)).toBe("1:01:01");
    });

    it("formatFileSize formats bytes", () => {
      expect(formatFileSize(500)).toMatch(/500/);
      expect(formatFileSize(1024)).toMatch(/1/);
      expect(formatFileSize(5242880)).toMatch(/5/);
    });

    it("formatHash truncates correctly", () => {
      const hash = "a".repeat(64);
      const result = formatHash(hash);
      expect(result.length).toBeLessThan(64);
      expect(result).toContain("...");
    });

    it("formatHash preserves short hashes", () => {
      expect(formatHash("abc")).toBe("abc");
    });

    it("formatPercent converts 0-1 to percentage", () => {
      expect(formatPercent(0.87)).toBe("87%");
      expect(formatPercent(1.0)).toBe("100%");
      expect(formatPercent(0.0)).toBe("0%");
    });

    it("formatRelativeTime handles recent", () => {
      const now = new Date().toISOString();
      expect(formatRelativeTime(now)).toBe("just now");
    });
  });

  describe("Risk Configuration", () => {
    it("all 5 risk levels are defined", () => {
      const levels = ["clear", "low", "moderate", "high", "critical"] as const;
      for (const level of levels) {
        expect(RISK_CONFIG[level]).toBeDefined();
        expect(RISK_CONFIG[level].color).toBeTruthy();
        expect(RISK_CONFIG[level].label).toBeTruthy();
      }
    });

    it("getRiskConfig returns valid config for any level", () => {
      expect(getRiskConfig("critical").color).toBeTruthy();
      expect(getRiskConfig("unknown_level").color).toBeTruthy(); // fallback
    });

    it("dimension colors are defined for all dimensions", () => {
      for (const dim of ["melody", "harmony", "rhythm", "timbre"]) {
        expect(DIMENSION_COLORS[dim]).toBeTruthy();
        expect(DIMENSION_COLORS[dim]).toMatch(/^#/);
      }
    });
  });

  describe("Downsample", () => {
    it("reduces array to target length", () => {
      const arr = Array.from({ length: 21000 }, (_, i) => i);
      const result = downsample(arr, 1000);
      expect(result.length).toBeLessThanOrEqual(1000);
      expect(result[0]).toBe(0);
    });

    it("preserves short arrays unchanged", () => {
      const arr = [1, 2, 3, 4, 5];
      const result = downsample(arr, 1000);
      expect(result).toEqual(arr);
    });

    it("handles empty array", () => {
      expect(downsample([], 100)).toEqual([]);
    });
  });
});
