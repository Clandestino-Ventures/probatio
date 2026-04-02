// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Clearance Monitor (Inngest Cron Function)
 *
 * Continuously monitors previously-cleared tracks against growing catalogs.
 * Runs weekly via cron AND after catalog ingestion completes.
 *
 * Efficiency: only compares against reference_tracks added SINCE the last
 * monitoring check. Does NOT re-run the full pipeline — uses stored
 * embeddings from spectral_signatures for fast cosine comparison.
 *
 * When a new match exceeds the screening threshold, creates a
 * clearance_alert for the user.
 *
 * Triggers:
 *   - Cron: Every Monday at 3 AM UTC
 */

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { cosineSimilarity } from "@/lib/pgvector";

const SCREENING_THRESHOLD = 0.50;
const WARNING_THRESHOLD = 0.60;
const CRITICAL_THRESHOLD = 0.70;

export const clearanceMonitor = inngest.createFunction(
  {
    id: "clearance-monitor",
    name: "Clearance Monitor (Weekly)",
    retries: 2,
  },
  { cron: "0 3 * * 1" },
  async ({ step }) => {
    const supabase = createAdminClient();

    // ── Step 1: Find all monitored analyses ───────────────────────────
    const monitoredAnalyses = await step.run(
      "find-monitored",
      async () => {
        const { data } = await supabase
          .from("analyses")
          .select(
            "id, user_id, monitoring_catalog_ids, last_monitored_at, created_at",
          )
          .eq("monitoring_enabled", true)
          .eq("mode", "clearance")
          .eq("status", "completed");

        return data ?? [];
      },
    );

    if (monitoredAnalyses.length === 0) {
      return { scanned: 0, alerts: 0 };
    }

    let totalAlerts = 0;

    // ── Step 2: Delta scan each monitored analysis ────────────────────
    for (const analysis of monitoredAnalyses) {
      const alertCount = await step.run(
        `scan-${analysis.id.slice(0, 8)}`,
        async () => {
          const since =
            analysis.last_monitored_at ?? analysis.created_at;
          const catalogIds = analysis.monitoring_catalog_ids ?? [];

          if (catalogIds.length === 0) return 0;

          // Fetch NEW reference tracks added since last check
          const { data: newTracks } = await supabase
            .from("reference_tracks")
            .select("id, title, artist, embedding, embedding_vocals")
            .in("catalog_id", catalogIds)
            .gt("created_at", since)
            .eq("fingerprinted", true)
            .not("embedding", "is", null);

          if (!newTracks || newTracks.length === 0) {
            // No new tracks — update timestamp and skip
            await supabase
              .from("analyses")
              .update({
                last_monitored_at: new Date().toISOString(),
              })
              .eq("id", analysis.id);
            return 0;
          }

          // Fetch the analysis's stored embeddings
          const { data: signatures } = await supabase
            .from("spectral_signatures")
            .select("dimension, embedding")
            .eq("analysis_id", analysis.id);

          if (!signatures || signatures.length === 0) return 0;

          const timbreEmb = signatures.find(
            (s) => s.dimension === "timbre",
          )?.embedding;
          const melodyEmb = signatures.find(
            (s) => s.dimension === "melody",
          )?.embedding;

          if (!timbreEmb && !melodyEmb) return 0;

          // Parse embeddings (may be string or number[])
          const parseEmb = (
            emb: unknown,
          ): number[] | null => {
            if (Array.isArray(emb)) return emb;
            if (typeof emb === "string") {
              try {
                return JSON.parse(emb);
              } catch {
                return null;
              }
            }
            return null;
          };

          const timbreVec = parseEmb(timbreEmb);
          const melodyVec = parseEmb(melodyEmb);

          let alerts = 0;

          for (const track of newTracks) {
            const trackEmb = parseEmb(track.embedding);
            const trackVocalEmb = parseEmb(track.embedding_vocals);

            // Compute max similarity across available dimensions
            let maxSim = 0;
            let matchDimension = "timbre";

            if (timbreVec && trackEmb && timbreVec.length === trackEmb.length) {
              const sim = cosineSimilarity(timbreVec, trackEmb);
              if (sim > maxSim) {
                maxSim = sim;
                matchDimension = "timbre";
              }
            }

            if (
              melodyVec &&
              trackVocalEmb &&
              melodyVec.length === trackVocalEmb.length
            ) {
              const sim = cosineSimilarity(melodyVec, trackVocalEmb);
              if (sim > maxSim) {
                maxSim = sim;
                matchDimension = "melody";
              }
            }

            if (maxSim >= SCREENING_THRESHOLD) {
              const severity =
                maxSim >= CRITICAL_THRESHOLD
                  ? "critical"
                  : maxSim >= WARNING_THRESHOLD
                    ? "warning"
                    : "info";

              await supabase.from("clearance_alerts").insert({
                analysis_id: analysis.id,
                user_id: analysis.user_id,
                reference_track_id: track.id,
                alert_type: "new_match",
                severity,
                message:
                  `New match detected: "${track.title}" by ${track.artist} ` +
                  `(${Math.round(maxSim * 100)}% ${matchDimension} similarity)`,
                details: {
                  similarity: maxSim,
                  dimension: matchDimension,
                  track_title: track.title,
                  track_artist: track.artist,
                },
              });
              alerts++;
            }
          }

          // Update last_monitored_at
          await supabase
            .from("analyses")
            .update({
              last_monitored_at: new Date().toISOString(),
            })
            .eq("id", analysis.id);

          return alerts;
        },
      );

      totalAlerts += alertCount;
    }

    return {
      scanned: monitoredAnalyses.length,
      alerts: totalAlerts,
    };
  },
);
