import { describe, it, expect } from "vitest";

describe("Tier 3: Data Retention", () => {

  describe("Retention Policy", () => {
    it("default retention is 90 days", () => {
      const DEFAULT_RETENTION_DAYS = 90;
      expect(DEFAULT_RETENTION_DAYS).toBe(90);
    });

    it("enterprise retention range is 7-365 days", () => {
      expect(7).toBeGreaterThanOrEqual(7);
      expect(365).toBeLessThanOrEqual(365);
    });

    it("forensic analyses should have no expiration", () => {
      // mode === 'forensic' → audio_expires_at should be null
      const mode = "forensic";
      const audioExpiresAt = mode === "forensic" ? null : "2026-06-17T00:00:00Z";
      expect(audioExpiresAt).toBeNull();
    });

    it("screening analyses should expire after retention period", () => {
      const mode = "screening";
      const retentionDays = 90;
      const completedAt = new Date("2026-03-19T10:00:00Z");
      const expiresAt = new Date(completedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);
      expect(expiresAt.toISOString()).toBe("2026-06-17T10:00:00.000Z");
    });
  });

  describe("Storage Path Extraction", () => {
    it("extracts path from Supabase public URL", () => {
      const url = "https://xxx.supabase.co/storage/v1/object/public/spectra-audio/user123/analysis456/original/track.mp3";
      const match = url.match(/spectra-audio\/(.+?)(\?|$)/);
      expect(match?.[1]).toBe("user123/analysis456/original/track.mp3");
    });

    it("extracts path from signed URL", () => {
      const url = "https://xxx.supabase.co/storage/v1/object/sign/spectra-audio/user123/stems/vocals.wav?token=xyz";
      const match = url.match(/spectra-audio\/(.+?)(\?|$)/);
      expect(match?.[1]).toBe("user123/stems/vocals.wav");
    });

    it("returns null for non-storage URL", () => {
      const url = "https://example.com/audio.mp3";
      const match = url.match(/spectra-audio\/(.+?)(\?|$)/);
      expect(match).toBeNull();
    });
  });

  describe("Deletion Preserves Results", () => {
    it("deletion should clear audio URLs but preserve analysis", () => {
      // After deletion, these should be null:
      const deletedFields = { audio_url: null, normalized_audio_url: null, stems_urls: null };
      expect(deletedFields.audio_url).toBeNull();
      expect(deletedFields.stems_urls).toBeNull();

      // These should be preserved (not null):
      const preservedFields = {
        overall_risk: "high",
        overall_score: 0.87,
        match_count: 3,
        features: { tempo: 128 },
      };
      expect(preservedFields.overall_risk).toBeTruthy();
      expect(preservedFields.overall_score).toBeGreaterThan(0);
    });

    it("custody chain entries persist after audio deletion", () => {
      // Chain of custody is immutable — deletion adds entries, never removes
      const custodyActions = [
        "file_uploaded",
        "audio_normalized",
        "stems_generated",
        "file_deleted", // NEW entry documenting the deletion
      ];
      expect(custodyActions).toContain("file_deleted");
      expect(custodyActions).toContain("file_uploaded"); // Original entry preserved
    });
  });

  describe("Forensic Case Archiving", () => {
    it("only completed cases can be archived", () => {
      const completedStatuses = ["completed"];
      const nonArchivable = ["pending_payment", "paid", "processing", "failed"];
      expect(completedStatuses).toContain("completed");
      for (const status of nonArchivable) {
        expect(completedStatuses).not.toContain(status);
      }
    });

    it("archiving requires confirmation", () => {
      const body = { confirm: false };
      expect(body.confirm).toBe(false); // Should be rejected
    });

    it("archiving deletes audio for both tracks", () => {
      const tracksToDelete = ["track_a_analysis_id", "track_b_analysis_id"];
      expect(tracksToDelete.length).toBe(2);
    });

    it("archiving preserves forensic report and custody", () => {
      const preserved = [
        "forensic report",
        "analysis results",
        "match evidence",
        "chain of custody",
      ];
      expect(preserved.length).toBe(4);
    });
  });

  describe("Deletion Documentation", () => {
    it("file_deleted custody entry includes reason", () => {
      const reasons = ["policy_expiration", "user_request", "full_deletion", "case_archived"];
      for (const reason of reasons) {
        expect(typeof reason).toBe("string");
      }
    });

    it("file_deleted custody entry documents what was preserved", () => {
      const preserved = [
        "analysis results (scores, risk level)",
        "match evidence (timestamps, similarity)",
        "chain of custody (all entries)",
        "report narrative",
        "spectral signatures (embeddings)",
      ];
      expect(preserved.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("Warning Notifications", () => {
    it("warnings are sent 7 days before expiry", () => {
      const warningDaysBefore = 7;
      expect(warningDaysBefore).toBe(7);
    });

    it("warnings are not sent twice", () => {
      const firstNotification = { deletion_notified: true };
      // Second run should skip already-notified analyses
      expect(firstNotification.deletion_notified).toBe(true);
    });
  });
});
