"use client";

import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// Brand Colors
// ────────────────────────────────────────────────────────────────────────────

const OBSIDIAN = { r: 10, g: 10, b: 11 };
const FORENSIC_BLUE = { r: 46, g: 108, b: 230 };
const SIGNAL_RED = { r: 230, g: 57, b: 38 };

// ────────────────────────────────────────────────────────────────────────────
// Color Interpolation
// ────────────────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Map a similarity value (0-1) to an RGB color.
 * 0.0 → obsidian, 0.5 → forensic-blue, 1.0 → signal-red
 */
function scoreToColor(value: number): { r: number; g: number; b: number } {
  const v = Math.max(0, Math.min(1, value));
  if (v <= 0.5) {
    const t = v / 0.5;
    return {
      r: Math.round(lerp(OBSIDIAN.r, FORENSIC_BLUE.r, t)),
      g: Math.round(lerp(OBSIDIAN.g, FORENSIC_BLUE.g, t)),
      b: Math.round(lerp(OBSIDIAN.b, FORENSIC_BLUE.b, t)),
    };
  }
  const t = (v - 0.5) / 0.5;
  return {
    r: Math.round(lerp(FORENSIC_BLUE.r, SIGNAL_RED.r, t)),
    g: Math.round(lerp(FORENSIC_BLUE.g, SIGNAL_RED.g, t)),
    b: Math.round(lerp(FORENSIC_BLUE.b, SIGNAL_RED.b, t)),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Tooltip State
// ────────────────────────────────────────────────────────────────────────────

interface TooltipState {
  x: number;
  y: number;
  row: number;
  col: number;
  value: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Evidence Row Type
// ────────────────────────────────────────────────────────────────────────────

export interface HeatmapEvidenceRow {
  source_start_sec: number;
  source_end_sec: number;
  target_start_sec: number;
  target_end_sec: number;
  similarity_score: number;
  dimension?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

interface SimilarityHeatmapProps {
  /** 2D array of similarity scores (0-1). Rows = reference segments, Cols = analyzed segments. */
  data?: number[][];
  /** Labels for the X axis (analyzed track time segments). */
  xLabels?: string[];
  /** Labels for the Y axis (reference track time segments). */
  yLabels?: string[];
  /**
   * Real match_evidence rows. When provided, the component builds the heatmap
   * grid from these instead of using `data`. Falls back to mock data when
   * neither `data` nor `evidence` is provided.
   */
  evidence?: HeatmapEvidenceRow[];
  /** Canvas width in px. If omitted, fills container. */
  width?: number;
  /** Canvas height in px. If omitted, uses aspect ratio of data. */
  height?: number;
  className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function SimilarityHeatmap({
  data: dataProp,
  xLabels: xLabelsProp,
  yLabels: yLabelsProp,
  evidence,
  width: propWidth,
  height: propHeight,
  className,
}: SimilarityHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // ── Build grid from evidence or fall back to props / mock ─────────────
  const { data, xLabels, yLabels } = useMemo(() => {
    // Priority 1: real evidence data
    if (evidence && evidence.length > 0) {
      return buildGridFromEvidence(evidence);
    }
    // Priority 2: explicit data prop
    if (dataProp && dataProp.length > 0) {
      return { data: dataProp, xLabels: xLabelsProp, yLabels: yLabelsProp };
    }
    // Priority 3: demo / mock data
    const mock = generateMockHeatmapData();
    return { data: mock.data, xLabels: mock.xLabels, yLabels: mock.yLabels };
  }, [evidence, dataProp, xLabelsProp, yLabelsProp]);

  // Layout constants
  const LABEL_FONT = '11px ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace';
  const LEFT_MARGIN = yLabels ? 60 : 10;
  const BOTTOM_MARGIN = xLabels ? 40 : 10;
  const TOP_MARGIN = 10;
  const RIGHT_MARGIN = 50; // for legend
  const LEGEND_WIDTH = 16;
  const LEGEND_GAP = 10;

  const rows = data.length;
  const cols = rows > 0 ? Math.max(...data.map((r) => r.length)) : 0;
  const isEmpty = rows === 0 || cols === 0;

  const resolvedWidth = propWidth ?? containerWidth;
  const plotWidth = Math.max(0, resolvedWidth - LEFT_MARGIN - RIGHT_MARGIN - LEGEND_GAP - LEGEND_WIDTH);
  const cellSize = plotWidth > 0 && cols > 0 ? plotWidth / cols : 4;
  const computedHeight = propHeight ?? (isEmpty ? 200 : TOP_MARGIN + rows * cellSize + BOTTOM_MARGIN);
  const plotHeight = Math.max(0, computedHeight - TOP_MARGIN - BOTTOM_MARGIN);
  const cellH = rows > 0 ? plotHeight / rows : 0;
  const cellW = cols > 0 ? plotWidth / cols : 0;

  // Observe container width for responsiveness
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Draw ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isEmpty) return;
    const canvas = canvasRef.current;
    if (!canvas || resolvedWidth === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = resolvedWidth * dpr;
    canvas.height = computedHeight * dpr;
    canvas.style.width = `${resolvedWidth}px`;
    canvas.style.height = `${computedHeight}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, resolvedWidth, computedHeight);

    // Draw heatmap cells
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = data[r]?.[c] ?? 0;
        const color = scoreToColor(v);
        ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
        ctx.fillRect(
          LEFT_MARGIN + c * cellW,
          TOP_MARGIN + r * cellH,
          Math.ceil(cellW) + 1,
          Math.ceil(cellH) + 1,
        );
      }
    }

    // Draw axis labels
    ctx.font = LABEL_FONT;
    ctx.fillStyle = "#8A8A8E";

    // Y-axis labels
    if (yLabels) {
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      const step = Math.max(1, Math.floor(rows / 10));
      for (let r = 0; r < rows; r += step) {
        const label = yLabels[r] ?? `${r}`;
        ctx.fillText(label, LEFT_MARGIN - 6, TOP_MARGIN + r * cellH + cellH / 2);
      }
    }

    // X-axis labels
    if (xLabels) {
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const step = Math.max(1, Math.floor(cols / 10));
      for (let c = 0; c < cols; c += step) {
        const label = xLabels[c] ?? `${c}`;
        ctx.save();
        ctx.translate(LEFT_MARGIN + c * cellW + cellW / 2, TOP_MARGIN + plotHeight + 6);
        ctx.rotate(-Math.PI / 6);
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }
    }

    // ── Color scale legend ────────────────────────────────────────────────
    const legendX = LEFT_MARGIN + plotWidth + LEGEND_GAP;
    const legendTop = TOP_MARGIN;
    const legendHeight = plotHeight;
    const legendSteps = Math.max(1, Math.floor(legendHeight));

    for (let i = 0; i < legendSteps; i++) {
      const t = i / legendSteps; // 0 = top = 1.0,  1 = bottom = 0.0
      const color = scoreToColor(1 - t);
      ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
      ctx.fillRect(legendX, legendTop + i, LEGEND_WIDTH, Math.ceil(legendHeight / legendSteps) + 1);
    }

    // Legend labels
    ctx.fillStyle = "#8A8A8E";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("1.0", legendX + LEGEND_WIDTH + 4, legendTop + 2);
    ctx.fillText("0.5", legendX + LEGEND_WIDTH + 4, legendTop + legendHeight / 2);
    ctx.fillText("0.0", legendX + LEGEND_WIDTH + 4, legendTop + legendHeight - 2);

    // Legend border
    ctx.strokeStyle = "#3A3A3F";
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendTop, LEGEND_WIDTH, legendHeight);
  }, [data, rows, cols, isEmpty, resolvedWidth, computedHeight, cellW, cellH, xLabels, yLabels, plotWidth, plotHeight, LEFT_MARGIN, BOTTOM_MARGIN, LABEL_FONT, LEGEND_GAP, LEGEND_WIDTH]);

  // ── Hover ───────────────────────────────────────────────────────────────

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isEmpty) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const col = Math.floor((mx - LEFT_MARGIN) / cellW);
      const row = Math.floor((my - TOP_MARGIN) / cellH);

      if (row >= 0 && row < rows && col >= 0 && col < cols) {
        setTooltip({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          row,
          col,
          value: data[row]?.[col] ?? 0,
        });
      } else {
        setTooltip(null);
      }
    },
    [data, rows, cols, cellW, cellH, LEFT_MARGIN, isEmpty],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  // ── Empty state ─────────────────────────────────────────────────────────

  if (isEmpty) {
    return (
      <div
        ref={containerRef}
        className={cn(
          "flex items-center justify-center rounded-lg border border-slate bg-obsidian font-mono text-xs text-ash",
          className,
        )}
        style={{ width: propWidth, height: propHeight ?? 200 }}
      >
        No heatmap data
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="block cursor-crosshair"
      />
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 rounded border border-slate bg-carbon px-2.5 py-1.5 font-mono text-xs text-bone shadow-lg"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 10,
            transform: "translateY(-100%)",
          }}
        >
          <span className="text-ash">
            [{yLabels?.[tooltip.row] ?? tooltip.row}, {xLabels?.[tooltip.col] ?? tooltip.col}]
          </span>{" "}
          <span
            className="font-semibold"
            style={{
              color: `rgb(${scoreToColor(tooltip.value).r},${scoreToColor(tooltip.value).g},${scoreToColor(tooltip.value).b})`,
            }}
          >
            {tooltip.value.toFixed(3)}
          </span>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Build Grid from Evidence
// ────────────────────────────────────────────────────────────────────────────

/**
 * Convert match_evidence rows into a 2D grid suitable for the heatmap.
 * Rows represent target (reference) time, columns represent source (query) time.
 * Each cell holds the maximum similarity score of any evidence row that overlaps it.
 */
function buildGridFromEvidence(
  evidence: HeatmapEvidenceRow[],
  gridSize: number = 48,
): { data: number[][]; xLabels: string[]; yLabels: string[] } {
  // Determine time extents
  let maxSource = 0;
  let maxTarget = 0;
  for (const e of evidence) {
    if (e.source_end_sec > maxSource) maxSource = e.source_end_sec;
    if (e.target_end_sec > maxTarget) maxTarget = e.target_end_sec;
  }

  // Guard against zero-length
  if (maxSource <= 0) maxSource = 1;
  if (maxTarget <= 0) maxTarget = 1;

  const cols = gridSize; // source axis (X)
  const rows = gridSize; // target axis (Y)
  const colStep = maxSource / cols;
  const rowStep = maxTarget / rows;

  // Initialize grid with zeros
  const grid: number[][] = Array.from({ length: rows }, () =>
    new Array<number>(cols).fill(0),
  );

  // Fill cells — for each evidence row, paint every cell it overlaps
  for (const e of evidence) {
    const colStart = Math.floor(e.source_start_sec / colStep);
    const colEnd = Math.min(cols - 1, Math.floor(e.source_end_sec / colStep));
    const rowStart = Math.floor(e.target_start_sec / rowStep);
    const rowEnd = Math.min(rows - 1, Math.floor(e.target_end_sec / rowStep));

    for (let r = rowStart; r <= rowEnd; r++) {
      for (let c = colStart; c <= colEnd; c++) {
        // Keep the maximum score when multiple evidence rows overlap a cell
        if (e.similarity_score > grid[r][c]) {
          grid[r][c] = e.similarity_score;
        }
      }
    }
  }

  // Build axis labels as timestamps
  const formatSec = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}s`;
  };

  const xLabels = Array.from({ length: cols }, (_, i) =>
    formatSec(i * colStep),
  );
  const yLabels = Array.from({ length: rows }, (_, i) =>
    formatSec(i * rowStep),
  );

  return { data: grid, xLabels, yLabels };
}

// ────────────────────────────────────────────────────────────────────────────
// Mock Data Helper
// ────────────────────────────────────────────────────────────────────────────

/**
 * Generate realistic mock heatmap data.
 * Creates a 2D correlation matrix with a hot diagonal band
 * (simulating sections where two tracks are similar).
 */
export function generateMockHeatmapData(
  rows: number = 40,
  cols: number = 50,
): {
  data: number[][];
  xLabels: string[];
  yLabels: string[];
} {
  const data: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < cols; c++) {
      // Create a diagonal hot region to simulate matched sections
      const diagDist = Math.abs(r / rows - c / cols);
      const diagonal = Math.exp(-diagDist * diagDist * 50);
      // Add a secondary hot cluster
      const clusterR = 0.6, clusterC = 0.7;
      const clusterDist = Math.sqrt(
        (r / rows - clusterR) ** 2 + (c / cols - clusterC) ** 2,
      );
      const cluster = 0.7 * Math.exp(-clusterDist * clusterDist * 80);
      // Base noise
      const noise = Math.random() * 0.08;
      row.push(Math.min(1, diagonal + cluster + noise));
    }
    data.push(row);
  }

  const xLabels = Array.from({ length: cols }, (_, i) => `${(i * 5).toFixed(0)}s`);
  const yLabels = Array.from({ length: rows }, (_, i) => `${(i * 5).toFixed(0)}s`);

  return { data, xLabels, yLabels };
}
