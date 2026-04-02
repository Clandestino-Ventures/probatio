"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface PianoRollProps {
  /** MIDI note numbers for Track A (plaintiff's work). */
  pitchContourA: number[];
  /** MIDI note numbers for Track B (defendant's work). */
  pitchContourB: number[];
  /** Time offset (seconds) for the start of this segment in Track A. */
  startSecA: number;
  /** Time offset (seconds) for the start of this segment in Track B. */
  startSecB: number;
  /** Duration of the segment in seconds. */
  segmentDuration: number;
  /** Detected transposition in semitones (B relative to A). */
  transpositionSemitones: number;
  /** Similarity score for this evidence point. */
  similarity?: number;
  className?: string;
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function midiToNoteName(midi: number): string {
  if (midi <= 0) return "";
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_NAMES[Math.round(midi) % 12];
  return `${note}${octave}`;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────

export function PianoRoll({
  pitchContourA,
  pitchContourB,
  startSecA,
  startSecB,
  segmentDuration,
  transpositionSemitones,
  similarity,
  className,
}: PianoRollProps) {
  const [showCorrected, setShowCorrected] = useState(false);

  // Filter silence (MIDI 0 or very low)
  const voicedA = pitchContourA.filter((m) => m > 20);
  const rawB = pitchContourB.filter((m) => m > 20);
  const voicedB = showCorrected
    ? rawB.map((m) => m - transpositionSemitones)
    : rawB;

  // Compute MIDI range
  const allNotes = [...voicedA, ...voicedB];
  if (allNotes.length === 0) {
    return (
      <div className={cn("text-xs text-ash text-center py-4", className)}>
        No pitch data available for piano roll
      </div>
    );
  }

  const minMidi = Math.floor(Math.min(...allNotes)) - 2;
  const maxMidi = Math.ceil(Math.max(...allNotes)) + 2;
  const noteRange = maxMidi - minMidi;

  // SVG dimensions
  const SVG_W = 600;
  const SVG_H = Math.max(150, noteRange * 10 + 60);
  const PAD = { top: 25, right: 20, bottom: 30, left: 45 };
  const plotW = SVG_W - PAD.left - PAD.right;
  const plotH = SVG_H - PAD.top - PAD.bottom;

  const xScale = (idx: number, total: number) =>
    PAD.left + (idx / Math.max(total - 1, 1)) * plotW;
  const yScale = (midi: number) =>
    PAD.top + plotH - ((midi - minMidi) / noteRange) * plotH;

  // Time tick labels
  const tickCount = Math.min(6, Math.ceil(segmentDuration));
  const ticks = useMemo(
    () =>
      Array.from({ length: tickCount + 1 }, (_, i) => ({
        sec: startSecA + (i / tickCount) * segmentDuration,
        x: PAD.left + (i / tickCount) * plotW,
      })),
    [tickCount, startSecA, segmentDuration, plotW],
  );

  // Note labels on Y axis
  const noteLabels = useMemo(() => {
    const labels: Array<{ midi: number; name: string; y: number }> = [];
    for (let m = minMidi; m <= maxMidi; m++) {
      if (m % 12 === 0 || m === minMidi || m === maxMidi) {
        labels.push({ midi: m, name: midiToNoteName(m), y: yScale(m) });
      }
    }
    return labels;
  }, [minMidi, maxMidi]);

  return (
    <div className={cn("w-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-[10px] text-ash uppercase tracking-wide">
          Piano Roll: Melody Comparison
          {similarity != null && (
            <span className="ml-2 text-bone font-mono">
              {Math.round(similarity * 100)}% similarity
            </span>
          )}
        </span>
        {transpositionSemitones !== 0 && (
          <label className="flex items-center gap-1.5 text-[10px] text-ash cursor-pointer">
            <input
              type="checkbox"
              checked={showCorrected}
              onChange={(e) => setShowCorrected(e.target.checked)}
              className="w-3 h-3 rounded accent-forensic-blue"
            />
            Show B transposition-corrected (
            {transpositionSemitones > 0 ? "-" : "+"}
            {Math.abs(transpositionSemitones)} st)
          </label>
        )}
      </div>

      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full bg-obsidian rounded"
        style={{ maxHeight: 300 }}
      >
        {/* Grid lines */}
        {noteLabels.map((n) => (
          <line
            key={n.midi}
            x1={PAD.left}
            y1={n.y}
            x2={PAD.left + plotW}
            y2={n.y}
            stroke="#2A2A2F"
            strokeWidth={0.5}
          />
        ))}

        {/* Track A notes (gold) */}
        {voicedA.map((midi, i) => {
          if (i >= voicedA.length - 1) return null;
          const x1 = xScale(i, voicedA.length);
          const x2 = xScale(i + 1, voicedA.length);
          return (
            <rect
              key={`a-${i}`}
              x={x1}
              y={yScale(midi) - 3}
              width={Math.max(x2 - x1 - 1, 2)}
              height={6}
              rx={1}
              fill="#D4A843"
              opacity={0.75}
            >
              <title>
                Track A: {midiToNoteName(midi)} (MIDI {Math.round(midi)})
              </title>
            </rect>
          );
        })}

        {/* Track B notes (red/blue depending on correction) */}
        {voicedB.map((midi, i) => {
          if (i >= voicedB.length - 1) return null;
          const x1 = xScale(i, voicedB.length);
          const x2 = xScale(i + 1, voicedB.length);
          return (
            <rect
              key={`b-${i}`}
              x={x1}
              y={yScale(midi) - 3}
              width={Math.max(x2 - x1 - 1, 2)}
              height={6}
              rx={1}
              fill={showCorrected ? "#2E6CE6" : "#E63926"}
              opacity={0.7}
            >
              <title>
                Track B{showCorrected ? " (corrected)" : ""}:{" "}
                {midiToNoteName(midi)} (MIDI {Math.round(midi)})
              </title>
            </rect>
          );
        })}

        {/* Y-axis labels */}
        {noteLabels.map((n) => (
          <text
            key={`label-${n.midi}`}
            x={PAD.left - 6}
            y={n.y + 3}
            textAnchor="end"
            fill="#5A5A5F"
            fontSize={8}
            fontFamily="monospace"
          >
            {n.name}
          </text>
        ))}

        {/* X-axis time labels */}
        {ticks.map((tick, i) => (
          <g key={i}>
            <line
              x1={tick.x}
              y1={PAD.top + plotH}
              x2={tick.x}
              y2={PAD.top + plotH + 4}
              stroke="#3A3A3F"
            />
            <text
              x={tick.x}
              y={PAD.top + plotH + 16}
              textAnchor="middle"
              fill="#5A5A5F"
              fontSize={8}
              fontFamily="monospace"
            >
              {formatTime(tick.sec)}
            </text>
          </g>
        ))}

        {/* Legend */}
        <rect x={PAD.left + 8} y={PAD.top + 4} width={8} height={8} rx={1} fill="#D4A843" opacity={0.75} />
        <text x={PAD.left + 20} y={PAD.top + 12} fill="#8A8A8E" fontSize={8}>
          Track A
        </text>
        <rect x={PAD.left + 75} y={PAD.top + 4} width={8} height={8} rx={1} fill={showCorrected ? "#2E6CE6" : "#E63926"} opacity={0.7} />
        <text x={PAD.left + 87} y={PAD.top + 12} fill="#8A8A8E" fontSize={8}>
          Track B{showCorrected ? " (corrected)" : ""}
        </text>
      </svg>
    </div>
  );
}
