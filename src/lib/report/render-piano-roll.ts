/**
 * PROBATIO — Server-Side Piano Roll PNG Renderer
 *
 * Renders a melodic contour comparison as a piano roll PNG using @napi-rs/canvas.
 * Shows Track A (gold) and Track B (red) MIDI note positions for visual
 * comparison of melodic similarity. For PDF embedding.
 */

import { createCanvas } from "@napi-rs/canvas";

interface PianoRollRenderOptions {
  pitchContourA: number[];
  pitchContourB: number[];
  startSecA: number;
  segmentDuration: number;
  transpositionSemitones: number;
  showCorrected?: boolean;
  similarity?: number;
  width?: number;
  height?: number;
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function midiToNoteName(midi: number): string {
  if (midi <= 0) return "";
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[Math.round(midi) % 12]}${octave}`;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export async function renderPianoRollPng(
  options: PianoRollRenderOptions,
): Promise<Buffer> {
  const {
    pitchContourA,
    pitchContourB: rawB,
    startSecA,
    segmentDuration,
    transpositionSemitones,
    showCorrected = true,
    similarity,
    width = 650,
    height = 280,
  } = options;

  const voicedA = pitchContourA.filter((m) => m > 20);
  const voicedB = showCorrected
    ? rawB.filter((m) => m > 20).map((m) => m - transpositionSemitones)
    : rawB.filter((m) => m > 20);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#0A0A0F";
  ctx.fillRect(0, 0, width, height);

  const pad = { top: 30, right: 20, bottom: 30, left: 45 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const allNotes = [...voicedA, ...voicedB];
  if (allNotes.length === 0) {
    ctx.fillStyle = "#8A8A8E";
    ctx.font = "12px Helvetica, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No pitch data available", width / 2, height / 2);
    return Buffer.from(canvas.toBuffer("image/png"));
  }

  const minMidi = Math.floor(Math.min(...allNotes)) - 2;
  const maxMidi = Math.ceil(Math.max(...allNotes)) + 2;
  const range = maxMidi - minMidi;

  const xScale = (idx: number, total: number) =>
    pad.left + (idx / Math.max(total - 1, 1)) * plotW;
  const yScale = (midi: number) =>
    pad.top + plotH - ((midi - minMidi) / range) * plotH;

  // Grid lines
  ctx.strokeStyle = "#2A2A2F";
  ctx.lineWidth = 0.5;
  for (let m = minMidi; m <= maxMidi; m++) {
    if (m % 12 === 0 || m === minMidi || m === maxMidi) {
      const y = yScale(m);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();

      ctx.fillStyle = "#5A5A5F";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      ctx.fillText(midiToNoteName(m), pad.left - 5, y + 3);
    }
  }

  // Track A notes (gold)
  ctx.fillStyle = "rgba(212, 168, 67, 0.8)";
  for (let i = 0; i < voicedA.length - 1; i++) {
    const x = xScale(i, voicedA.length);
    const w = Math.max(xScale(i + 1, voicedA.length) - x - 1, 2);
    ctx.fillRect(x, yScale(voicedA[i]) - 3, w, 6);
  }

  // Track B notes (red or blue if corrected)
  ctx.fillStyle = showCorrected
    ? "rgba(46, 108, 230, 0.75)"
    : "rgba(230, 57, 38, 0.75)";
  for (let i = 0; i < voicedB.length - 1; i++) {
    const x = xScale(i, voicedB.length);
    const w = Math.max(xScale(i + 1, voicedB.length) - x - 1, 2);
    ctx.fillRect(x, yScale(voicedB[i]) - 3, w, 6);
  }

  // Title
  ctx.fillStyle = "#F5F0EB";
  ctx.font = "bold 11px Helvetica, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(
    `Piano Roll: Melody Comparison${similarity != null ? ` (${Math.round(similarity * 100)}%)` : ""}`,
    pad.left,
    16,
  );

  // Legend
  ctx.fillStyle = "rgba(212, 168, 67, 0.8)";
  ctx.fillRect(pad.left + plotW - 140, 6, 10, 10);
  ctx.fillStyle = "#8A8A8E";
  ctx.font = "9px Helvetica, sans-serif";
  ctx.fillText("Track A", pad.left + plotW - 126, 15);

  ctx.fillStyle = showCorrected
    ? "rgba(46, 108, 230, 0.75)"
    : "rgba(230, 57, 38, 0.75)";
  ctx.fillRect(pad.left + plotW - 65, 6, 10, 10);
  ctx.fillStyle = "#8A8A8E";
  ctx.fillText(
    `Track B${showCorrected ? " (corr.)" : ""}`,
    pad.left + plotW - 51,
    15,
  );

  // X-axis
  const tickCount = Math.min(6, Math.ceil(segmentDuration));
  ctx.fillStyle = "#5A5A5F";
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  for (let i = 0; i <= tickCount; i++) {
    const sec = startSecA + (i / tickCount) * segmentDuration;
    const x = pad.left + (i / tickCount) * plotW;
    ctx.fillText(formatTime(sec), x, height - 8);
  }

  return Buffer.from(canvas.toBuffer("image/png"));
}
