"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { DIMENSION_COLORS, DIMENSION_LABELS } from "@/lib/config/risk-config";

interface EvidencePoint {
  dimension: string;
  similarity_score: number;
  source_start_sec: number;
  source_end_sec: number;
}

interface EvidenceTimelineProps {
  duration: number;
  evidence: EvidencePoint[];
  onSegmentClick?: (startSec: number, endSec: number) => void;
  className?: string;
}

export function EvidenceTimeline({
  duration,
  evidence,
  onSegmentClick,
  className,
}: EvidenceTimelineProps) {
  const HEIGHT = 80;
  const PADDING_X = 40;
  const PADDING_Y = 20;
  const BAR_HEIGHT = 40;

  // Group evidence by dimension for stacking
  const dimensionOrder = ["melody", "harmony", "rhythm", "timbre"];
  const grouped = useMemo(() => {
    const map = new Map<string, EvidencePoint[]>();
    for (const dim of dimensionOrder) {
      map.set(dim, evidence.filter(e => e.dimension === dim));
    }
    return map;
  }, [evidence]);

  // Count per dimension for legend
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const [dim, points] of grouped) c[dim] = points.length;
    return c;
  }, [grouped]);

  // Format time as M:SS
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Generate time axis labels
  const tickCount = Math.min(8, Math.floor(duration / 30) + 1);
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((i / tickCount) * duration)
  );

  if (duration <= 0) return null;

  const svgWidth = 600;
  const innerWidth = svgWidth - PADDING_X * 2;

  const xScale = (sec: number) => PADDING_X + (sec / duration) * innerWidth;

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${svgWidth} ${HEIGHT + PADDING_Y + 30}`}
        className="w-full"
        style={{ maxHeight: 140 }}
      >
        {/* Track duration background */}
        <rect
          x={PADDING_X}
          y={PADDING_Y}
          width={innerWidth}
          height={BAR_HEIGHT}
          rx={4}
          fill="#1E1E21"
          stroke="#3A3A3F"
          strokeWidth={0.5}
        />

        {/* Evidence blocks */}
        {dimensionOrder.map((dim, dimIdx) => {
          const points = grouped.get(dim) ?? [];
          const laneHeight = BAR_HEIGHT / dimensionOrder.length;
          const y = PADDING_Y + dimIdx * laneHeight;

          return points.map((ev, i) => {
            const x1 = xScale(ev.source_start_sec);
            const x2 = xScale(ev.source_end_sec);
            const width = Math.max(x2 - x1, 3); // min 3px width

            return (
              <rect
                key={`${dim}-${i}`}
                x={x1}
                y={y + 1}
                width={width}
                height={laneHeight - 2}
                rx={2}
                fill={DIMENSION_COLORS[dim] ?? "#8A8A8E"}
                opacity={0.4 + ev.similarity_score * 0.6}
                className="cursor-pointer hover:opacity-100 transition-opacity"
                onClick={() => onSegmentClick?.(ev.source_start_sec, ev.source_end_sec)}
              />
            );
          });
        })}

        {/* Time axis */}
        {ticks.map((sec) => (
          <g key={sec}>
            <line
              x1={xScale(sec)}
              y1={PADDING_Y + BAR_HEIGHT}
              x2={xScale(sec)}
              y2={PADDING_Y + BAR_HEIGHT + 5}
              stroke="#3A3A3F"
            />
            <text
              x={xScale(sec)}
              y={PADDING_Y + BAR_HEIGHT + 18}
              textAnchor="middle"
              fill="#8A8A8E"
              fontSize={10}
            >
              {formatTime(sec)}
            </text>
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-1 px-2">
        {dimensionOrder.map((dim) => (
          <div key={dim} className="flex items-center gap-1.5 text-xs text-ash">
            <div
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: DIMENSION_COLORS[dim] }}
            />
            <span>{DIMENSION_LABELS[dim]} ({counts[dim] ?? 0})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
