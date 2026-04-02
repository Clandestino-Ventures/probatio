"use client";

import { useMemo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { DIMENSION_COLORS, DIMENSION_LABELS } from "@/lib/config/risk-config";
import type { MatchEvidenceRow } from "@/types/database";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

type Dimension = "melody" | "harmony" | "rhythm" | "timbre" | "lyrics";

interface EvidenceTimelineVisualProps {
  evidence: MatchEvidenceRow[];
  durationA: number;
  durationB: number;
  titleA: string;
  titleB: string;
  activeDimension: Dimension | "all";
  onSegmentClick?: (evidenceId: string) => void;
  className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function EvidenceTimelineVisual({
  evidence,
  durationA,
  durationB,
  titleA,
  titleB,
  activeDimension,
  onSegmentClick,
  className,
}: EvidenceTimelineVisualProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Filter by active dimension
  const filtered = useMemo(() => {
    if (activeDimension === "all") return evidence;
    return evidence.filter((e) => e.dimension === activeDimension);
  }, [evidence, activeDimension]);

  // SVG dimensions
  const SVG_WIDTH = 800;
  const SVG_HEIGHT = 200;
  const PADDING_X = 50;
  const PADDING_Y = 30;
  const TRACK_HEIGHT = 24;
  const TRACK_GAP = 80;
  const INNER_WIDTH = SVG_WIDTH - PADDING_X * 2;

  const trackAY = PADDING_Y;
  const trackBY = PADDING_Y + TRACK_HEIGHT + TRACK_GAP;

  // Scale functions
  const xScaleA = useCallback(
    (sec: number) => {
      if (durationA <= 0) return PADDING_X;
      return PADDING_X + (sec / durationA) * INNER_WIDTH;
    },
    [durationA, INNER_WIDTH],
  );

  const xScaleB = useCallback(
    (sec: number) => {
      if (durationB <= 0) return PADDING_X;
      return PADDING_X + (sec / durationB) * INNER_WIDTH;
    },
    [durationB, INNER_WIDTH],
  );

  // Time ticks
  const ticksA = useMemo(() => {
    const count = Math.min(10, Math.max(2, Math.floor(durationA / 30) + 1));
    return Array.from({ length: count + 1 }, (_, i) =>
      Math.round((i / count) * durationA),
    );
  }, [durationA]);

  const ticksB = useMemo(() => {
    const count = Math.min(10, Math.max(2, Math.floor(durationB / 30) + 1));
    return Array.from({ length: count + 1 }, (_, i) =>
      Math.round((i / count) * durationB),
    );
  }, [durationB]);

  if (durationA <= 0 || durationB <= 0 || filtered.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center h-32 rounded-lg border border-slate bg-obsidian text-xs text-ash",
          className,
        )}
      >
        No timeline data available
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="w-full"
        style={{ maxHeight: 240 }}
      >
        {/* Track A label */}
        <text
          x={PADDING_X}
          y={trackAY - 8}
          fill="#8A8A8E"
          fontSize={10}
          fontFamily="ui-monospace, monospace"
        >
          A: {titleA.length > 40 ? titleA.slice(0, 40) + "…" : titleA}
        </text>

        {/* Track A timeline background */}
        <rect
          x={PADDING_X}
          y={trackAY}
          width={INNER_WIDTH}
          height={TRACK_HEIGHT}
          rx={4}
          fill="#1E1E21"
          stroke="#3A3A3F"
          strokeWidth={0.5}
        />

        {/* Track A time ticks */}
        {ticksA.map((sec) => (
          <g key={`ta-${sec}`}>
            <line
              x1={xScaleA(sec)}
              y1={trackAY + TRACK_HEIGHT}
              x2={xScaleA(sec)}
              y2={trackAY + TRACK_HEIGHT + 4}
              stroke="#3A3A3F"
            />
            <text
              x={xScaleA(sec)}
              y={trackAY + TRACK_HEIGHT + 14}
              textAnchor="middle"
              fill="#5A5A5F"
              fontSize={8}
              fontFamily="ui-monospace, monospace"
            >
              {formatTime(sec)}
            </text>
          </g>
        ))}

        {/* Track B label */}
        <text
          x={PADDING_X}
          y={trackBY - 8}
          fill="#8A8A8E"
          fontSize={10}
          fontFamily="ui-monospace, monospace"
        >
          B: {titleB.length > 40 ? titleB.slice(0, 40) + "…" : titleB}
        </text>

        {/* Track B timeline background */}
        <rect
          x={PADDING_X}
          y={trackBY}
          width={INNER_WIDTH}
          height={TRACK_HEIGHT}
          rx={4}
          fill="#1E1E21"
          stroke="#3A3A3F"
          strokeWidth={0.5}
        />

        {/* Track B time ticks */}
        {ticksB.map((sec) => (
          <g key={`tb-${sec}`}>
            <line
              x1={xScaleB(sec)}
              y1={trackBY + TRACK_HEIGHT}
              x2={xScaleB(sec)}
              y2={trackBY + TRACK_HEIGHT + 4}
              stroke="#3A3A3F"
            />
            <text
              x={xScaleB(sec)}
              y={trackBY + TRACK_HEIGHT + 14}
              textAnchor="middle"
              fill="#5A5A5F"
              fontSize={8}
              fontFamily="ui-monospace, monospace"
            >
              {formatTime(sec)}
            </text>
          </g>
        ))}

        {/* Connecting lines (drawn first so segments render on top) */}
        {filtered.map((ev) => {
          const color = DIMENSION_COLORS[ev.dimension] ?? "#8A8A8E";
          const srcMid =
            (xScaleA(ev.source_start_sec) + xScaleA(ev.source_end_sec)) / 2;
          const tgtMid =
            (xScaleB(ev.target_start_sec) + xScaleB(ev.target_end_sec)) / 2;

          const isHovered = hoveredId === ev.id;
          const lineOpacity = isHovered
            ? 0.8
            : 0.15 + ev.similarity_score * 0.25;
          const lineWidth = isHovered
            ? 2
            : 0.5 + ev.similarity_score * 1.5;

          return (
            <line
              key={`line-${ev.id}`}
              x1={srcMid}
              y1={trackAY + TRACK_HEIGHT}
              x2={tgtMid}
              y2={trackBY}
              stroke={color}
              strokeWidth={lineWidth}
              opacity={lineOpacity}
              strokeDasharray={isHovered ? undefined : "4 3"}
              className="pointer-events-none transition-opacity"
            />
          );
        })}

        {/* Track A evidence segments */}
        {filtered.map((ev) => {
          const color = DIMENSION_COLORS[ev.dimension] ?? "#8A8A8E";
          const x1 = xScaleA(ev.source_start_sec);
          const x2 = xScaleA(ev.source_end_sec);
          const width = Math.max(x2 - x1, 3);
          const isHovered = hoveredId === ev.id;

          return (
            <rect
              key={`a-${ev.id}`}
              x={x1}
              y={trackAY + 2}
              width={width}
              height={TRACK_HEIGHT - 4}
              rx={2}
              fill={color}
              opacity={
                isHovered ? 0.95 : 0.3 + ev.similarity_score * 0.5
              }
              className="cursor-pointer transition-opacity"
              onMouseEnter={() => setHoveredId(ev.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onSegmentClick?.(ev.id)}
            >
              <title>
                {DIMENSION_LABELS[ev.dimension] ?? ev.dimension}:{" "}
                {Math.round(ev.similarity_score * 100)}% |{" "}
                {formatTime(ev.source_start_sec)}-
                {formatTime(ev.source_end_sec)} (A) →{" "}
                {formatTime(ev.target_start_sec)}-
                {formatTime(ev.target_end_sec)} (B)
              </title>
            </rect>
          );
        })}

        {/* Track B evidence segments */}
        {filtered.map((ev) => {
          const color = DIMENSION_COLORS[ev.dimension] ?? "#8A8A8E";
          const x1 = xScaleB(ev.target_start_sec);
          const x2 = xScaleB(ev.target_end_sec);
          const width = Math.max(x2 - x1, 3);
          const isHovered = hoveredId === ev.id;

          return (
            <rect
              key={`b-${ev.id}`}
              x={x1}
              y={trackBY + 2}
              width={width}
              height={TRACK_HEIGHT - 4}
              rx={2}
              fill={color}
              opacity={
                isHovered ? 0.95 : 0.3 + ev.similarity_score * 0.5
              }
              className="cursor-pointer transition-opacity"
              onMouseEnter={() => setHoveredId(ev.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onSegmentClick?.(ev.id)}
            >
              <title>
                {DIMENSION_LABELS[ev.dimension] ?? ev.dimension}:{" "}
                {Math.round(ev.similarity_score * 100)}% |{" "}
                {formatTime(ev.source_start_sec)}-
                {formatTime(ev.source_end_sec)} (A) →{" "}
                {formatTime(ev.target_start_sec)}-
                {formatTime(ev.target_end_sec)} (B)
              </title>
            </rect>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-1 px-2">
        {(["melody", "harmony", "rhythm", "timbre", "lyrics"] as const).map(
          (dim) => {
            const count = filtered.filter((e) => e.dimension === dim).length;
            if (count === 0) return null;
            return (
              <div
                key={dim}
                className="flex items-center gap-1.5 text-xs text-ash"
              >
                <div
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: DIMENSION_COLORS[dim] }}
                />
                <span>
                  {DIMENSION_LABELS[dim]} ({count})
                </span>
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}
