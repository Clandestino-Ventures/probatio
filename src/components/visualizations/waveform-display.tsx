"use client";

import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// Brand Colors
// ────────────────────────────────────────────────────────────────────────────

const ASH = "#8A8A8E";
const SIGNAL_RED = "#E63926";
const FORENSIC_BLUE = "#2E6CE6";

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

interface HighlightRegion {
  /** Start time in seconds. */
  start: number;
  /** End time in seconds. */
  end: number;
  /** Override color for this region. Defaults to signal-red. */
  color?: string;
}

interface WaveformDisplayProps {
  /** Normalized audio samples (-1 to 1). */
  samples: number[];
  /** Regions to highlight (e.g. matching segments). */
  highlightRegions?: HighlightRegion[];
  /** Current playback position in seconds. */
  currentTime?: number;
  /** Total duration in seconds. */
  duration: number;
  /** Canvas width in px. If omitted, fills container. */
  width?: number;
  /** Canvas height in px. Default 120. */
  height?: number;
  /** Callback when user clicks to seek. */
  onSeek?: (time: number) => void;
  className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function WaveformDisplay({
  samples,
  highlightRegions = [],
  currentTime,
  duration,
  width: propWidth,
  height: propHeight = 120,
  onSeek,
  className,
}: WaveformDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const resolvedWidth = propWidth ?? containerWidth;
  const resolvedHeight = propHeight;
  const isEmpty = samples.length === 0;

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
    canvas.height = resolvedHeight * dpr;
    canvas.style.width = `${resolvedWidth}px`;
    canvas.style.height = `${resolvedHeight}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, resolvedWidth, resolvedHeight);

    const centerY = resolvedHeight / 2;
    const numBars = Math.min(samples.length, resolvedWidth);
    const barWidth = resolvedWidth / numBars;
    const samplesPerBar = samples.length / numBars;

    for (let i = 0; i < numBars; i++) {
      // Peak amplitude in this bar's sample range
      const startSample = Math.floor(i * samplesPerBar);
      const endSample = Math.min(Math.floor((i + 1) * samplesPerBar), samples.length);

      let maxAmp = 0;
      for (let s = startSample; s < endSample; s++) {
        const abs = Math.abs(samples[s] ?? 0);
        if (abs > maxAmp) maxAmp = abs;
      }

      // Clamp and compute bar height
      maxAmp = Math.min(1, maxAmp);
      const barHeight = maxAmp * (resolvedHeight - 4); // 2px padding top/bottom

      // Determine color based on whether this time position falls in a highlight region
      const ratio = i / numBars;
      const t = ratio * duration;
      let color = ASH;
      for (const region of highlightRegions) {
        if (t >= region.start && t <= region.end) {
          color = region.color ?? SIGNAL_RED;
          break;
        }
      }

      ctx.fillStyle = color;
      const x = i * barWidth;
      const w = Math.max(1, barWidth - (barWidth > 3 ? 1 : 0));

      // Draw symmetrically from center
      ctx.fillRect(x, centerY - barHeight / 2, w, barHeight || 1);
    }

    // ── Current time cursor ───────────────────────────────────────────────
    if (currentTime !== undefined && duration > 0) {
      const cursorX = (currentTime / duration) * resolvedWidth;
      ctx.strokeStyle = FORENSIC_BLUE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, resolvedHeight);
      ctx.stroke();
    }
  }, [samples, highlightRegions, currentTime, duration, resolvedWidth, resolvedHeight, isEmpty]);

  // ── Click to seek ───────────────────────────────────────────────────────

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onSeek || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = x / rect.width;
      onSeek(ratio * duration);
    },
    [onSeek, duration],
  );

  // ── Empty state ─────────────────────────────────────────────────────────

  if (isEmpty) {
    return (
      <div
        ref={containerRef}
        className={cn(
          "flex items-center justify-center rounded-lg border border-slate font-mono text-xs text-ash",
          className,
        )}
        style={{ width: propWidth, height: resolvedHeight }}
      >
        No waveform data
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className={cn("block", onSeek && "cursor-pointer")}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Mock Data Helper
// ────────────────────────────────────────────────────────────────────────────

/**
 * Generate realistic mock waveform samples.
 * Creates an envelope with verse/chorus dynamics and some noise.
 */
export function generateMockWaveformData(numSamples: number = 4000): {
  samples: number[];
  duration: number;
  highlightRegions: HighlightRegion[];
} {
  const samples: number[] = [];
  const duration = 180; // 3 minutes

  for (let i = 0; i < numSamples; i++) {
    const t = i / numSamples;
    // Envelope: quiet intro, loud chorus, bridge, loud outro
    let envelope = 0.3;
    if (t > 0.15 && t < 0.4) envelope = 0.7 + 0.2 * Math.sin((t - 0.15) * Math.PI / 0.25);
    if (t > 0.5 && t < 0.75) envelope = 0.8 + 0.15 * Math.sin((t - 0.5) * Math.PI / 0.25);
    if (t > 0.85) envelope = 0.6;

    // Simulate audio: mix of sine waves + noise
    const signal =
      Math.sin(t * 200) * 0.3 +
      Math.sin(t * 523) * 0.2 +
      Math.sin(t * 1047) * 0.1 +
      (Math.random() * 2 - 1) * 0.4;

    samples.push(Math.max(-1, Math.min(1, signal * envelope)));
  }

  // Highlight regions where "infringement" was detected
  const highlightRegions: HighlightRegion[] = [
    { start: 28, end: 55 },
    { start: 95, end: 118, color: "#F97316" }, // risk-high orange for a secondary match
  ];

  return { samples, duration, highlightRegions };
}
