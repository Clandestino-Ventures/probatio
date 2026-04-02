"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Header } from "@/components/dashboard/header";
import { Button, Badge } from "@/components/ui";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Download,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { ClearanceBatchRow } from "@/types/database";

interface BatchAnalysis {
  id: string;
  file_name: string;
  status: string;
  clearance_status: string | null;
  overall_score: number | null;
  overall_risk: string | null;
  match_count: number;
  created_at: string;
}

const VERDICT_CONFIG = {
  cleared: {
    icon: ShieldCheck,
    color: "text-risk-low",
    bg: "bg-risk-low/10 border-risk-low/30",
  },
  conditional: {
    icon: ShieldAlert,
    color: "text-evidence-gold",
    bg: "bg-evidence-gold/10 border-evidence-gold/30",
  },
  blocked: {
    icon: ShieldX,
    color: "text-signal-red",
    bg: "bg-signal-red/10 border-signal-red/30",
  },
} as const;

const STATUS_ICONS: Record<string, typeof CheckCircle> = {
  completed: CheckCircle,
  failed: XCircle,
  queued: Clock,
};

const CLEARANCE_COLORS: Record<string, string> = {
  cleared: "text-risk-low",
  conditional: "text-evidence-gold",
  blocked: "text-signal-red",
};

export default function BatchDetailPage() {
  const { batchId } = useParams() as { batchId: string };
  const t = useTranslations("clearanceBatch");

  const [batch, setBatch] = useState<ClearanceBatchRow | null>(null);
  const [analyses, setAnalyses] = useState<BatchAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBatch = useCallback(async () => {
    const res = await fetch(`/api/clearance/batch/${batchId}`);
    if (res.ok) {
      const data = await res.json();
      setBatch(data.batch);
      setAnalyses(data.analyses);
    }
    setLoading(false);
  }, [batchId]);

  useEffect(() => {
    fetchBatch();
  }, [fetchBatch]);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`batch-${batchId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "clearance_batches",
          filter: `id=eq.${batchId}`,
        },
        (payload) => {
          setBatch(payload.new as ClearanceBatchRow);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "analyses",
          filter: `batch_id=eq.${batchId}`,
        },
        () => {
          // Refetch analyses on any update
          fetchBatch();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [batchId, fetchBatch]);

  if (loading) {
    return (
      <>
        <Header title={t("title")} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-forensic-blue" />
        </div>
      </>
    );
  }

  if (!batch) {
    return (
      <>
        <Header title={t("title")} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-ash">Batch not found.</p>
        </div>
      </>
    );
  }

  const verdict = batch.overall_verdict as keyof typeof VERDICT_CONFIG | null;
  const verdictConfig = verdict ? VERDICT_CONFIG[verdict] : null;
  const VerdictIcon = verdictConfig?.icon;
  const pct =
    batch.track_count > 0
      ? Math.round((batch.tracks_completed / batch.track_count) * 100)
      : 0;
  const allDone = batch.status === "completed" || batch.status === "partial";

  return (
    <>
      <Header title={batch.name} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
          {/* Back link */}
          <Link
            href="/dashboard/history"
            className="inline-flex items-center gap-1 text-sm text-ash hover:text-bone transition-colors"
          >
            <ArrowLeft size={14} />
            {t("backToBatches")}
          </Link>

          {/* Batch Header */}
          <div className="bg-carbon border border-slate rounded-lg p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-semibold text-bone">
                  {batch.name}
                </h2>
                <p className="text-sm text-ash mt-1">
                  {batch.track_count} tracks ·{" "}
                  {batch.tracks_completed} completed
                  {batch.credits_used > 0 &&
                    ` · ${batch.credits_used} credits used`}
                </p>
              </div>

              {/* Overall Verdict */}
              {verdictConfig && VerdictIcon && (
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${verdictConfig.bg}`}
                >
                  <VerdictIcon size={20} className={verdictConfig.color} />
                  <div>
                    <p
                      className={`text-sm font-semibold ${verdictConfig.color}`}
                    >
                      {t(`verdict.${verdict}`)}
                    </p>
                    <p className="text-xs text-ash">
                      {t(`verdictDescription.${verdict}`, {
                        cleared: batch.tracks_cleared,
                        conditional: batch.tracks_conditional,
                        blocked: batch.tracks_blocked,
                        total: batch.track_count,
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Progress bar */}
            {batch.status === "processing" && (
              <div className="mt-4">
                <div className="h-2 bg-graphite rounded-full overflow-hidden">
                  <div
                    className="h-full bg-forensic-blue rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-ash mt-1 block">
                  {pct}% — {batch.tracks_completed} of{" "}
                  {batch.track_count}
                </span>
              </div>
            )}
          </div>

          {/* Track Table */}
          <div className="bg-carbon border border-slate rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate/50 text-xs text-ash">
                    <th className="px-4 py-2.5 text-left font-medium">
                      {t("trackTable.track")}
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium">
                      {t("trackTable.status")}
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium">
                      {t("trackTable.verdict")}
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium">
                      {t("trackTable.score")}
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium">
                      {t("trackTable.detail")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analyses.map((a) => {
                    const isRunning =
                      a.status !== "completed" && a.status !== "failed";
                    const Icon = isRunning
                      ? Loader2
                      : (STATUS_ICONS[a.status] ?? Clock);
                    const clearColor =
                      CLEARANCE_COLORS[a.clearance_status ?? ""] ??
                      "text-ash";

                    return (
                      <tr
                        key={a.id}
                        className="border-b border-slate/20 hover:bg-graphite/30"
                      >
                        <td className="px-4 py-2.5 text-bone truncate max-w-[250px]">
                          {a.file_name}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center gap-1 text-xs ${isRunning ? "text-forensic-blue" : a.status === "failed" ? "text-signal-red" : "text-risk-low"}`}
                          >
                            <Icon
                              size={12}
                              className={
                                isRunning ? "animate-spin" : ""
                              }
                            />
                            {isRunning
                              ? t("trackTable.running")
                              : a.status === "failed"
                                ? t("trackTable.failed")
                                : t("trackTable.done")}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {a.clearance_status ? (
                            <span
                              className={`text-xs font-medium capitalize ${clearColor}`}
                            >
                              {a.clearance_status}
                            </span>
                          ) : (
                            <span className="text-xs text-ash">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-ash">
                          {a.overall_score != null
                            ? `${Math.round(a.overall_score * 100)}%`
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          {a.status === "completed" && (
                            <Link
                              href={`/dashboard/analyses/${a.id}`}
                              className="text-xs text-forensic-blue hover:underline"
                            >
                              View
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Download Report (when all done) */}
          {allDone && (
            <div className="flex justify-center">
              <Button
                onClick={() =>
                  window.open(
                    `/api/clearance/batch/${batchId}/report`,
                    "_blank",
                  )
                }
              >
                <Download size={14} />
                {t("downloadReport")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
