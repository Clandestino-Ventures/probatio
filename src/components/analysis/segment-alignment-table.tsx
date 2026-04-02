"use client";

import { useMemo, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { DIMENSION_COLORS, DIMENSION_LABELS } from "@/lib/config/risk-config";
import {
  Play,
  Pause,
  Download,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import type { MatchEvidenceRow } from "@/types/database";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

type Dimension = "melody" | "harmony" | "rhythm" | "timbre" | "lyrics";
type SortField =
  | "source_start_sec"
  | "target_start_sec"
  | "dimension"
  | "similarity_score"
  | "dtw_distance";
type SortDir = "asc" | "desc";

interface SegmentAlignmentTableProps {
  evidence: MatchEvidenceRow[];
  matchId: string;
  activeDimension: Dimension | "all";
  onDimensionChange: (dim: Dimension | "all") => void;
  onPlayA?: (startSec: number, durationSec: number) => void;
  onPlayB?: (startSec: number, durationSec: number) => void;
  playingA?: { startSec: number; endSec: number } | null;
  playingB?: { startSec: number; endSec: number } | null;
  audioAvailableA?: boolean;
  audioAvailableB?: boolean;
  highlightedEvidenceId?: string | null;
  className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTimeRange(start: number, end: number): string {
  return `${formatTime(start)}-${formatTime(end)}`;
}

function similarityColor(score: number): string {
  if (score >= 0.8) return "bg-signal-red/20 text-signal-red";
  if (score >= 0.6) return "bg-evidence-gold/20 text-evidence-gold";
  return "bg-risk-low/20 text-risk-low";
}

function getDtwDistance(detail: Record<string, unknown>): number | null {
  if (typeof detail?.dtw_distance === "number") return detail.dtw_distance;
  return null;
}

function getTransposition(detail: Record<string, unknown>): number | null {
  if (typeof detail?.transposition_semitones === "number")
    return detail.transposition_semitones;
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function SegmentAlignmentTable({
  evidence,
  matchId,
  activeDimension,
  onDimensionChange,
  onPlayA,
  onPlayB,
  playingA,
  playingB,
  audioAvailableA = true,
  audioAvailableB = true,
  highlightedEvidenceId,
  className,
}: SegmentAlignmentTableProps) {
  const t = useTranslations("segmentAlignment");
  const [sortField, setSortField] = useState<SortField>("similarity_score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  // Dimension filter
  const filtered = useMemo(() => {
    if (activeDimension === "all") return evidence;
    return evidence.filter((e) => e.dimension === activeDimension);
  }, [evidence, activeDimension]);

  // Dimension counts
  const dimCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of evidence) {
      counts[e.dimension] = (counts[e.dimension] ?? 0) + 1;
    }
    return counts;
  }, [evidence]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let va: number | string = 0;
      let vb: number | string = 0;
      switch (sortField) {
        case "source_start_sec":
          va = a.source_start_sec;
          vb = b.source_start_sec;
          break;
        case "target_start_sec":
          va = a.target_start_sec;
          vb = b.target_start_sec;
          break;
        case "dimension":
          va = a.dimension;
          vb = b.dimension;
          break;
        case "similarity_score":
          va = a.similarity_score;
          vb = b.similarity_score;
          break;
        case "dtw_distance":
          va = getDtwDistance(a.detail) ?? 999;
          vb = getDtwDistance(b.detail) ?? 999;
          break;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  // Pagination
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const showingFrom = sorted.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const showingTo = Math.min((page + 1) * PAGE_SIZE, sorted.length);

  // Reset page when filter changes
  const handleDimensionChange = useCallback(
    (dim: Dimension | "all") => {
      setPage(0);
      onDimensionChange(dim);
    },
    [onDimensionChange],
  );

  // Sort toggle
  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir(field === "similarity_score" ? "desc" : "asc");
      }
      setPage(0);
    },
    [sortField],
  );

  // CSV export
  const exportCsv = useCallback(() => {
    const rows = [
      [
        "source_start",
        "source_end",
        "target_start",
        "target_end",
        "dimension",
        "similarity_score",
        "dtw_distance",
        "transposition",
      ].join(","),
      ...filtered.map((e) =>
        [
          e.source_start_sec.toFixed(2),
          e.source_end_sec.toFixed(2),
          e.target_start_sec.toFixed(2),
          e.target_end_sec.toFixed(2),
          e.dimension,
          e.similarity_score.toFixed(4),
          getDtwDistance(e.detail)?.toFixed(4) ?? "",
          getTransposition(e.detail) ?? "",
        ].join(","),
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `probatio-evidence-${matchId}-${activeDimension}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered, matchId, activeDimension]);

  // Summary
  const highest = useMemo(() => {
    if (filtered.length === 0) return null;
    return filtered.reduce((best, e) =>
      e.similarity_score > best.similarity_score ? e : best,
    );
  }, [filtered]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ChevronDown size={12} className="opacity-30" />;
    return sortDir === "asc" ? (
      <ChevronUp size={12} />
    ) : (
      <ChevronDown size={12} />
    );
  };

  const dimensions: Array<Dimension | "all"> = [
    "all",
    "melody",
    "harmony",
    "rhythm",
    "timbre",
    "lyrics",
  ];

  return (
    <div className={cn("bg-carbon border border-slate rounded-lg", className)}>
      {/* Header + Filter Tabs + Export */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate/50 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {dimensions.map((dim) => {
            const count =
              dim === "all"
                ? evidence.length
                : (dimCounts[dim] ?? 0);
            if (dim !== "all" && count === 0) return null;
            const active = activeDimension === dim;
            const color =
              dim !== "all" ? DIMENSION_COLORS[dim] : undefined;
            return (
              <button
                key={dim}
                onClick={() => handleDimensionChange(dim)}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                  active
                    ? "bg-graphite text-bone"
                    : "text-ash hover:text-bone hover:bg-graphite/50",
                )}
                style={
                  active && color
                    ? { borderBottom: `2px solid ${color}` }
                    : undefined
                }
              >
                {t(`filters.${dim}`)}
                <span className="ml-1 text-ash">({count})</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate text-xs text-ash hover:text-bone hover:border-bone/30 transition-colors"
        >
          <Download size={12} />
          {t("exportCsv")}
        </button>
      </div>

      {/* Summary */}
      {highest && (
        <div className="px-4 py-2 border-b border-slate/30 text-xs text-ash">
          {t("summary", {
            count: filtered.length,
            dimension:
              DIMENSION_LABELS[highest.dimension] ?? highest.dimension,
            score: `${Math.round(highest.similarity_score * 100)}%`,
            timeA: formatTime(highest.source_start_sec),
            timeB: formatTime(highest.target_start_sec),
          })}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate/50 text-ash">
              {(
                [
                  ["source_start_sec", "sourceTime"],
                  ["target_start_sec", "targetTime"],
                  ["dimension", "dimension"],
                  ["similarity_score", "similarity"],
                  ["dtw_distance", "dtwDistance"],
                ] as [SortField, string][]
              ).map(([field, labelKey]) => (
                <th
                  key={field}
                  className="px-3 py-2 text-left font-medium cursor-pointer hover:text-bone transition-colors whitespace-nowrap"
                  onClick={() => handleSort(field)}
                >
                  <span className="inline-flex items-center gap-1">
                    {t(`columns.${labelKey}`)}
                    <SortIcon field={field} />
                  </span>
                </th>
              ))}
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">
                {t("columns.transposition")}
              </th>
              <th className="px-3 py-2 w-20" />
            </tr>
          </thead>
          <tbody>
            {pageData.map((ev) => {
              const dtw = getDtwDistance(ev.detail);
              const trans = getTransposition(ev.detail);
              const isHighlighted = ev.id === highlightedEvidenceId;
              const isPlayingRowA =
                playingA &&
                Math.abs(playingA.startSec - ev.source_start_sec) < 0.1;
              const isPlayingRowB =
                playingB &&
                Math.abs(playingB.startSec - ev.target_start_sec) < 0.1;

              return (
                <tr
                  key={ev.id}
                  id={`evidence-${ev.id}`}
                  className={cn(
                    "border-b border-slate/20 hover:bg-graphite/30 transition-colors",
                    isHighlighted && "bg-forensic-blue/10",
                    (isPlayingRowA || isPlayingRowB) && "bg-graphite/40",
                  )}
                >
                  <td className="px-3 py-2 font-mono whitespace-nowrap">
                    {formatTimeRange(ev.source_start_sec, ev.source_end_sec)}
                  </td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">
                    {formatTimeRange(ev.target_start_sec, ev.target_end_sec)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium capitalize"
                      style={{
                        backgroundColor: `${DIMENSION_COLORS[ev.dimension] ?? "#8A8A8E"}20`,
                        color: DIMENSION_COLORS[ev.dimension] ?? "#8A8A8E",
                      }}
                    >
                      {DIMENSION_LABELS[ev.dimension] ?? ev.dimension}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-block px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold",
                        similarityColor(ev.similarity_score),
                      )}
                    >
                      {(ev.similarity_score * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-ash">
                    {dtw != null ? dtw.toFixed(3) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {trans != null && trans !== 0 ? (
                      <span className="inline-block px-1.5 py-0.5 rounded bg-graphite text-bone text-[10px] font-mono">
                        {trans > 0 ? "+" : ""}
                        {t("semitones", { n: trans })}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          onPlayA?.(
                            ev.source_start_sec,
                            ev.source_end_sec - ev.source_start_sec,
                          )
                        }
                        disabled={!audioAvailableA}
                        title={
                          audioAvailableA
                            ? t("playA")
                            : t("audioUnavailable")
                        }
                        className={cn(
                          "w-6 h-6 flex items-center justify-center rounded transition-colors",
                          audioAvailableA
                            ? "hover:bg-evidence-gold/20 text-evidence-gold"
                            : "opacity-30 cursor-not-allowed text-ash",
                        )}
                      >
                        {isPlayingRowA ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Play size={11} />
                        )}
                      </button>
                      <button
                        onClick={() =>
                          onPlayB?.(
                            ev.target_start_sec,
                            ev.target_end_sec - ev.target_start_sec,
                          )
                        }
                        disabled={!audioAvailableB}
                        title={
                          audioAvailableB
                            ? t("playB")
                            : t("audioUnavailable")
                        }
                        className={cn(
                          "w-6 h-6 flex items-center justify-center rounded transition-colors",
                          audioAvailableB
                            ? "hover:bg-forensic-blue/20 text-forensic-blue"
                            : "opacity-30 cursor-not-allowed text-ash",
                        )}
                      >
                        {isPlayingRowB ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Play size={11} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {pageData.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-ash"
                >
                  {t("noEvidence", { score: "—" })}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate/50 text-xs text-ash">
          <span>
            {t("pagination.showing", {
              from: showingFrom,
              to: showingTo,
              total: sorted.length,
            })}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 rounded hover:bg-graphite disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() =>
                setPage((p) => Math.min(totalPages - 1, p + 1))
              }
              disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded hover:bg-graphite disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
