/**
 * PROBATIO — Server-Side Heatmap PNG Renderer
 *
 * Renders similarity heatmaps as PNG buffers using @napi-rs/canvas.
 * Identical visual to the browser heatmap but as a static image
 * suitable for embedding in @react-pdf/renderer PDF documents.
 *
 * Color scale: obsidian (0.0) → forensic-blue (0.5) → signal-red (1.0)
 */

import { createCanvas } from "@napi-rs/canvas";

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface HeatmapEvidence {
  source_start_sec: number;
  source_end_sec: number;
  target_start_sec: number;
  target_end_sec: number;
  similarity_score: number;
  dimension?: string;
}

interface HeatmapRenderOptions {
  evidence: HeatmapEvidence[];
  sourceDuration: number;
  targetDuration: number;
  width?: number;
  height?: number;
  dimension?: string | null;
  title?: string;
  gridSize?: number;
}

// ────────────────────────────────────────────────────────────────
// Color scale (matches browser heatmap exactly)
// ────────────────────────────────────────────────────────────────

const OBSIDIAN = { r: 10, g: 10, b: 11 };
const FORENSIC_BLUE = { r: 46, g: 108, b: 230 };
const SIGNAL_RED = { r: 230, g: 57, b: 38 };

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function scoreToColor(value: number): string {
  const v = Math.max(0, Math.min(1, value));
  let r: number, g: number, b: number;
  if (v <= 0.5) {
    const t = v / 0.5;
    r = Math.round(lerp(OBSIDIAN.r, FORENSIC_BLUE.r, t));
    g = Math.round(lerp(OBSIDIAN.g, FORENSIC_BLUE.g, t));
    b = Math.round(lerp(OBSIDIAN.b, FORENSIC_BLUE.b, t));
  } else {
    const t = (v - 0.5) / 0.5;
    r = Math.round(lerp(FORENSIC_BLUE.r, SIGNAL_RED.r, t));
    g = Math.round(lerp(FORENSIC_BLUE.g, SIGNAL_RED.g, t));
    b = Math.round(lerp(FORENSIC_BLUE.b, SIGNAL_RED.b, t));
  }
  return `rgb(${r},${g},${b})`;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ────────────────────────────────────────────────────────────────
// Renderer
// ────────────────────────────────────────────────────────────────

export async function renderHeatmapPng(
  options: HeatmapRenderOptions,
): Promise<Buffer> {
  const {
    evidence,
    sourceDuration,
    targetDuration,
    width = 700,
    height = 450,
    dimension = null,
    title,
    gridSize = 40,
  } = options;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  const margin = { top: 40, right: 55, bottom: 45, left: 55 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const cols = gridSize;
  const rows = gridSize;
  const cellW = plotW / cols;
  const cellH = plotH / rows;

  const maxSrc = Math.max(sourceDuration, 1);
  const maxTgt = Math.max(targetDuration, 1);
  const colStep = maxTgt / cols;
  const rowStep = maxSrc / rows;

  // Filter evidence
  const filtered =
    dimension && dimension !== "all"
      ? evidence.filter((e) => e.dimension === dimension)
      : evidence;

  // Build grid
  const grid: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(0),
  );

  for (const ev of filtered) {
    const colStart = Math.floor(ev.target_start_sec / colStep);
    const colEnd = Math.min(
      cols - 1,
      Math.floor(ev.target_end_sec / colStep),
    );
    const rowStart = Math.floor(ev.source_start_sec / rowStep);
    const rowEnd = Math.min(
      rows - 1,
      Math.floor(ev.source_end_sec / rowStep),
    );

    for (let r = rowStart; r <= rowEnd; r++) {
      for (let c = colStart; c <= colEnd; c++) {
        if (ev.similarity_score > grid[r][c]) {
          grid[r][c] = ev.similarity_score;
        }
      }
    }
  }

  // Draw cells
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = margin.left + c * cellW;
      const y = margin.top + r * cellH;
      const v = grid[r][c];
      ctx.fillStyle = v > 0 ? scoreToColor(v) : "#F5F5F5";
      ctx.fillRect(x, y, Math.ceil(cellW) + 1, Math.ceil(cellH) + 1);
    }
  }

  // Plot border
  ctx.strokeStyle = "#E0E0E0";
  ctx.lineWidth = 1;
  ctx.strokeRect(margin.left, margin.top, plotW, plotH);

  // Title
  if (title) {
    ctx.fillStyle = "#1A1A2E";
    ctx.font = "bold 13px Helvetica, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, width / 2, 22);
  }

  // Axis labels
  ctx.fillStyle = "#8A8A8E";
  ctx.font = "10px monospace";

  // X-axis (target / reference)
  ctx.textAlign = "center";
  const xTickCount = Math.min(8, Math.floor(maxTgt / 30) + 1);
  for (let i = 0; i <= xTickCount; i++) {
    const sec = Math.round((i / xTickCount) * maxTgt);
    const x = margin.left + (sec / maxTgt) * plotW;
    ctx.fillText(formatTime(sec), x, height - margin.bottom + 20);

    ctx.strokeStyle = "#E0E0E0";
    ctx.beginPath();
    ctx.moveTo(x, margin.top + plotH);
    ctx.lineTo(x, margin.top + plotH + 4);
    ctx.stroke();
  }

  // Y-axis (source / query)
  ctx.textAlign = "right";
  const yTickCount = Math.min(8, Math.floor(maxSrc / 30) + 1);
  for (let i = 0; i <= yTickCount; i++) {
    const sec = Math.round((i / yTickCount) * maxSrc);
    const y = margin.top + (sec / maxSrc) * plotH;
    ctx.fillText(formatTime(sec), margin.left - 8, y + 4);
  }

  // Axis titles
  ctx.fillStyle = "#666666";
  ctx.font = "10px Helvetica, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Reference Track (time)", width / 2, height - 5);

  ctx.save();
  ctx.translate(12, margin.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Query Track (time)", 0, 0);
  ctx.restore();

  // Color legend
  const legendX = width - margin.right + 10;
  const legendW = 14;
  const legendH = plotH;
  const legendSteps = Math.floor(legendH);

  for (let i = 0; i < legendSteps; i++) {
    const t = i / legendSteps; // 0=top=1.0, 1=bottom=0.0
    ctx.fillStyle = scoreToColor(1 - t);
    ctx.fillRect(legendX, margin.top + i, legendW, 2);
  }

  ctx.strokeStyle = "#E0E0E0";
  ctx.strokeRect(legendX, margin.top, legendW, legendH);

  ctx.fillStyle = "#8A8A8E";
  ctx.font = "9px monospace";
  ctx.textAlign = "left";
  ctx.fillText("1.0", legendX + legendW + 3, margin.top + 6);
  ctx.fillText("0.5", legendX + legendW + 3, margin.top + legendH / 2 + 3);
  ctx.fillText("0.0", legendX + legendW + 3, margin.top + legendH);

  return Buffer.from(canvas.toBuffer("image/png"));
}
