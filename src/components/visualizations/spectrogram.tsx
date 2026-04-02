"use client";

import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// Brand Colors (RGB)
// ────────────────────────────────────────────────────────────────────────────

const PALETTE = [
  { r: 10, g: 10, b: 11 },     // obsidian — silence
  { r: 46, g: 108, b: 230 },   // forensic-blue — low
  { r: 196, g: 153, b: 46 },   // evidence-gold — mid
  { r: 230, g: 57, b: 38 },    // signal-red — high
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Map an intensity value (0-1) to an RGB color via
 * a 4-stop gradient: obsidian -> forensic-blue -> evidence-gold -> signal-red.
 */
function intensityToColor(value: number): { r: number; g: number; b: number } {
  const v = Math.max(0, Math.min(1, value));
  const segment = v * (PALETTE.length - 1);
  const idx = Math.min(Math.floor(segment), PALETTE.length - 2);
  const t = segment - idx;

  const a = PALETTE[idx]!;
  const b_ = PALETTE[idx + 1]!;

  return {
    r: Math.round(lerp(a.r, b_.r, t)),
    g: Math.round(lerp(a.g, b_.g, t)),
    b: Math.round(lerp(a.b, b_.b, t)),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const LABEL_FONT = '10px ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace';
const LEFT_MARGIN = 52;
const BOTTOM_MARGIN = 28;
const TOP_MARGIN = 8;
const RIGHT_MARGIN = 8;

const FREQ_LABELS = [
  { value: 100, text: "100Hz" },
  { value: 1000, text: "1kHz" },
  { value: 5000, text: "5kHz" },
  { value: 10000, text: "10kHz" },
  { value: 20000, text: "20kHz" },
];

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

interface SpectrogramProps {
  /**
   * 2D array: data[freqBin][timeFrame], values 0-1.
   * freqBin 0 = lowest frequency, freqBin[last] = highest frequency.
   */
  data: number[][];
  /** Canvas width in px. Fills container if omitted. */
  width?: number;
  /** Canvas height in px. Default 300. */
  height?: number;
  /** Sample rate in Hz for computing frequency labels. Default 44100. */
  sampleRate?: number;
  className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function Spectrogram({
  data,
  width: propWidth,
  height: propHeight = 300,
  sampleRate = 44100,
  className,
}: SpectrogramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Zoom / pan state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  const isDragging = useRef(false);
  const dragStart = useRef(0);
  const panStart = useRef(0);

  const resolvedWidth = propWidth ?? containerWidth;
  const resolvedHeight = propHeight;

  const numFreqBins = data.length;
  const numTimeFrames = numFreqBins > 0 ? Math.max(...data.map((b) => b.length)) : 0;
  const isEmpty = numFreqBins === 0 || numTimeFrames === 0;

  const plotWidth = Math.max(0, resolvedWidth - LEFT_MARGIN - RIGHT_MARGIN);
  const plotHeight = Math.max(0, resolvedHeight - TOP_MARGIN - BOTTOM_MARGIN);

  // Max frequency (Nyquist)
  const maxFreq = sampleRate / 2;

  // Observe container width
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
    if (!canvas || resolvedWidth === 0 || plotWidth <= 0 || plotHeight <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = resolvedWidth * dpr;
    canvas.height = resolvedHeight * dpr;
    canvas.style.width = `${resolvedWidth}px`;
    canvas.style.height = `${resolvedHeight}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, resolvedWidth, resolvedHeight);

    // Compute visible time range based on zoom & pan
    const visibleFrames = numTimeFrames / zoomLevel;
    const maxPan = Math.max(0, numTimeFrames - visibleFrames);
    const clampedPan = Math.max(0, Math.min(panOffset, maxPan));
    const startFrame = clampedPan;
    const endFrame = startFrame + visibleFrames;

    // Cell dimensions in the plot area
    const cellW = plotWidth / visibleFrames;
    const cellH = plotHeight / numFreqBins;

    // Use ImageData for performance when cells are small
    if (cellW < 3 && cellH < 3) {
      const imgW = Math.ceil(plotWidth);
      const imgH = Math.ceil(plotHeight);
      const imageData = ctx.createImageData(imgW, imgH);
      const pixels = imageData.data;

      for (let py = 0; py < imgH; py++) {
        // Map pixel y to frequency bin (inverted: 0 = top = high freq)
        const freqBin = Math.floor((1 - py / plotHeight) * numFreqBins);
        const clampedBin = Math.max(0, Math.min(numFreqBins - 1, freqBin));

        for (let px = 0; px < imgW; px++) {
          // Map pixel x to time frame
          const frame = Math.floor(startFrame + (px / plotWidth) * visibleFrames);
          const clampedFrame = Math.max(0, Math.min(numTimeFrames - 1, frame));

          const intensity = data[clampedBin]?.[clampedFrame] ?? 0;
          const color = intensityToColor(intensity);

          const idx = (py * imgW + px) * 4;
          pixels[idx] = color.r;
          pixels[idx + 1] = color.g;
          pixels[idx + 2] = color.b;
          pixels[idx + 3] = 255;
        }
      }
      ctx.putImageData(imageData, LEFT_MARGIN, TOP_MARGIN);
    } else {
      // fillRect-based drawing for larger cells
      for (let f = 0; f < numFreqBins; f++) {
        const y = TOP_MARGIN + (1 - (f + 1) / numFreqBins) * plotHeight;

        for (
          let t = Math.floor(startFrame);
          t < Math.min(Math.ceil(endFrame), numTimeFrames);
          t++
        ) {
          const x = LEFT_MARGIN + (t - startFrame) * cellW;
          const intensity = data[f]?.[t] ?? 0;
          const color = intensityToColor(intensity);

          ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
          ctx.fillRect(x, y, Math.ceil(cellW) + 1, Math.ceil(cellH) + 1);
        }
      }
    }

    // ── Y-axis: frequency labels ──────────────────────────────────────────
    ctx.font = LABEL_FONT;
    ctx.fillStyle = "#8A8A8E";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (const fl of FREQ_LABELS) {
      if (fl.value > maxFreq) continue;
      const ratio = fl.value / maxFreq;
      const y = TOP_MARGIN + (1 - ratio) * plotHeight;
      ctx.fillText(fl.text, LEFT_MARGIN - 6, y);

      // Gridline
      ctx.strokeStyle = "rgba(138,138,142,0.15)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(LEFT_MARGIN, y);
      ctx.lineTo(LEFT_MARGIN + plotWidth, y);
      ctx.stroke();
    }

    // ── X-axis: time labels ───────────────────────────────────────────────
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#8A8A8E";

    // Estimate ~10ms per frame by default
    const totalDurationEstimate = numTimeFrames * 0.01;
    const visibleDurationStart = (startFrame / numTimeFrames) * totalDurationEstimate;
    const visibleDurationEnd = (endFrame / numTimeFrames) * totalDurationEstimate;
    const visibleDuration = visibleDurationEnd - visibleDurationStart;

    if (visibleDuration > 0) {
      const targetTicks = Math.max(2, Math.floor(plotWidth / 80));
      const rawStep = visibleDuration / targetTicks;
      const niceSteps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 30, 60];
      const step = niceSteps.find((s) => s >= rawStep) ?? rawStep;

      const firstTick = Math.ceil(visibleDurationStart / step) * step;
      for (let t = firstTick; t <= visibleDurationEnd; t += step) {
        const x =
          LEFT_MARGIN +
          ((t - visibleDurationStart) / visibleDuration) * plotWidth;

        const label = t < 1 ? `${(t * 1000).toFixed(0)}ms` : `${t.toFixed(1)}s`;
        ctx.fillText(label, x, TOP_MARGIN + plotHeight + 6);
      }
    }

    // ── Plot border ───────────────────────────────────────────────────────
    ctx.strokeStyle = "#3A3A3F";
    ctx.lineWidth = 1;
    ctx.strokeRect(LEFT_MARGIN, TOP_MARGIN, plotWidth, plotHeight);
  }, [data, numFreqBins, numTimeFrames, isEmpty, resolvedWidth, resolvedHeight, plotWidth, plotHeight, zoomLevel, panOffset, maxFreq, sampleRate]);

  // ── Zoom (mouse wheel) ─────────────────────────────────────────────────

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoomLevel((prev) => Math.max(1, Math.min(50, prev * delta)));
    },
    [],
  );

  // ── Pan (click + drag) ─────────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoomLevel <= 1) return;
      isDragging.current = true;
      dragStart.current = e.clientX;
      panStart.current = panOffset;
    },
    [zoomLevel, panOffset],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - dragStart.current;
      const framesPerPixel = plotWidth > 0 ? (numTimeFrames / zoomLevel) / plotWidth : 0;
      setPanOffset(panStart.current - dx * framesPerPixel);
    },
    [numTimeFrames, zoomLevel, plotWidth],
  );

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // ── Empty state ─────────────────────────────────────────────────────────

  if (isEmpty) {
    return (
      <div
        ref={containerRef}
        className={cn(
          "flex items-center justify-center rounded-lg border border-slate bg-obsidian font-mono text-xs text-ash",
          className,
        )}
        style={{ width: propWidth, height: resolvedHeight }}
      >
        No spectrogram data
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={cn("block", zoomLevel > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair")}
      />
      {zoomLevel > 1 && (
        <div className="absolute right-3 top-3 rounded bg-carbon/90 px-2 py-1 font-mono text-[10px] text-ash">
          {zoomLevel.toFixed(1)}x
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Mock Data Helper
// ────────────────────────────────────────────────────────────────────────────

/**
 * Generate realistic mock spectrogram data.
 * Creates frequency content with harmonics, formants, and some transients.
 *
 * @param numFreqBins  Number of frequency bins (default 128).
 * @param numTimeFrames  Number of time frames (default 256).
 * @returns 2D array [freqBin][timeFrame] with values 0-1.
 */
export function generateMockSpectrogramData(
  numFreqBins: number = 128,
  numTimeFrames: number = 256,
): number[][] {
  const data: number[][] = [];

  for (let f = 0; f < numFreqBins; f++) {
    const row: number[] = [];
    const freqRatio = f / numFreqBins; // 0 = low, 1 = high

    for (let t = 0; t < numTimeFrames; t++) {
      const timeRatio = t / numTimeFrames;

      // Base energy: more energy in low frequencies
      let energy = Math.exp(-freqRatio * 3) * 0.3;

      // Harmonic series (simulate a pitched instrument)
      const fundamentalBin = Math.floor(numFreqBins * 0.05);
      for (let h = 1; h <= 8; h++) {
        const harmonicBin = fundamentalBin * h;
        const dist = Math.abs(f - harmonicBin);
        if (dist < 3) {
          const harmonicStrength = Math.exp(-h * 0.3) * 0.8;
          const timeEnvelope =
            Math.sin(timeRatio * Math.PI) *
            (0.5 + 0.5 * Math.sin(timeRatio * 12));
          energy += harmonicStrength * Math.exp(-dist * dist * 0.5) * Math.max(0, timeEnvelope);
        }
      }

      // Broadband transients (drum hits)
      const transientTimes = [0.1, 0.3, 0.5, 0.7, 0.9];
      for (const tt of transientTimes) {
        const timeDist = Math.abs(timeRatio - tt);
        if (timeDist < 0.015) {
          energy += 0.6 * Math.exp(-timeDist * timeDist * 8000);
        }
      }

      // Noise floor
      energy += Math.random() * 0.04;

      row.push(Math.min(1, Math.max(0, energy)));
    }
    data.push(row);
  }

  return data;
}
