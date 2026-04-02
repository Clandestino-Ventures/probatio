"use client";

import { useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { DIMENSION_COLORS, DIMENSION_LABELS } from "@/lib/config/risk-config";
import { useSynchronizedPlayback } from "@/hooks/use-synchronized-playback";
import {
  Play,
  Pause,
  Square,
  Link,
  Unlink,
  Volume2,
  Loader2,
} from "lucide-react";
import type { MatchEvidenceRow } from "@/types/database";

type Dimension = "melody" | "harmony" | "rhythm" | "timbre" | "lyrics";

interface SynchronizedPlayerProps {
  trackA: { id: string; fileName: string; duration: number; audioUrl: string | null };
  trackB: { id: string; fileName: string; duration: number; audioUrl: string | null };
  evidence: MatchEvidenceRow[];
  activeDimension: Dimension | "all";
  onDimensionChange: (dim: Dimension | "all") => void;
  onEvidenceSelect?: (evidenceId: string) => void;
  onTimeUpdate?: (timeA: number, timeB: number) => void;
  className?: string;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.5] as const;
const DIM_TABS: Array<Dimension | "all"> = ["all", "melody", "harmony", "rhythm", "timbre", "lyrics"];

export function SynchronizedPlayer({
  trackA,
  trackB,
  evidence,
  activeDimension,
  onDimensionChange,
  onEvidenceSelect,
  onTimeUpdate,
  className,
}: SynchronizedPlayerProps) {
  const containerRefA = useRef<HTMLDivElement>(null);
  const containerRefB = useRef<HTMLDivElement>(null);

  const handleRegionClick = useCallback(
    (evidenceId: string) => {
      onEvidenceSelect?.(evidenceId);
    },
    [onEvidenceSelect],
  );

  const {
    play,
    pause,
    stop,
    playEvidencePair,
    setPlaybackRate,
    setVolumeA,
    setVolumeB,
    isPlaying,
    isReady,
    currentTimeA,
    currentTimeB,
    durationA,
    durationB,
    isLinked,
    toggleLink,
    playbackRate,
    volumeA,
    volumeB,
    playingEvidence,
  } = useSynchronizedPlayback({
    audioUrlA: trackA.audioUrl,
    audioUrlB: trackB.audioUrl,
    containerRefA,
    containerRefB,
    evidence,
    activeDimension,
    onTimeUpdate,
    onRegionClick: handleRegionClick,
  });

  // Top evidence sorted by similarity
  const topEvidence = [...evidence]
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, 8);

  // No audio state
  if (!trackA.audioUrl && !trackB.audioUrl) {
    return (
      <div
        className={cn(
          "bg-carbon border border-slate rounded-lg p-8 text-center",
          className,
        )}
      >
        <p className="text-sm text-ash">
          Audio playback not available. Upload the original files to enable
          synchronized playback.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-carbon border border-slate rounded-lg overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate/50">
        <h3 className="text-sm font-medium text-bone">
          Synchronized Playback
        </h3>
        <button
          onClick={toggleLink}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors",
            isLinked
              ? "bg-forensic-blue/20 text-forensic-blue"
              : "bg-graphite text-ash hover:text-bone",
          )}
          title={isLinked ? "Playheads linked (proportional)" : "Playheads independent"}
        >
          {isLinked ? <Link size={12} /> : <Unlink size={12} />}
          {isLinked ? "Linked" : "Unlinked"}
        </button>
      </div>

      {/* Track A Waveform */}
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-evidence-gold uppercase tracking-wide">
            Track A
          </span>
          <span className="text-[10px] text-ash truncate max-w-[200px]">
            {trackA.fileName}
          </span>
        </div>
        <div className="relative">
          <div ref={containerRefA} className="min-h-[80px]" />
          {!isReady && trackA.audioUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-obsidian/50">
              <Loader2 size={18} className="animate-spin text-evidence-gold" />
            </div>
          )}
        </div>
        <div className="flex justify-between text-[10px] text-ash font-mono mt-0.5">
          <span>{formatTime(currentTimeA)}</span>
          <span>{formatTime(durationA)}</span>
        </div>
      </div>

      {/* Track B Waveform */}
      <div className="px-4 pt-2 pb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-forensic-blue uppercase tracking-wide">
            Track B
          </span>
          <span className="text-[10px] text-ash truncate max-w-[200px]">
            {trackB.fileName}
          </span>
        </div>
        <div className="relative">
          <div ref={containerRefB} className="min-h-[80px]" />
          {!isReady && trackB.audioUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-obsidian/50">
              <Loader2 size={18} className="animate-spin text-forensic-blue" />
            </div>
          )}
        </div>
        <div className="flex justify-between text-[10px] text-ash font-mono mt-0.5">
          <span>{formatTime(currentTimeB)}</span>
          <span>{formatTime(durationB)}</span>
        </div>
      </div>

      {/* Transport Controls */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate/50 bg-graphite/30">
        <div className="flex items-center gap-2">
          <button
            onClick={stop}
            disabled={!isReady}
            className="w-7 h-7 flex items-center justify-center rounded text-ash hover:text-bone disabled:opacity-30 transition-colors"
            aria-label="Stop"
          >
            <Square size={14} />
          </button>
          <button
            onClick={isPlaying ? pause : play}
            disabled={!isReady}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-forensic-blue text-bone hover:bg-forensic-blue/90 disabled:opacity-30 transition-colors"
            aria-label={isPlaying ? "Pause both tracks" : "Play both tracks simultaneously"}
          >
            {isPlaying ? (
              <Pause size={16} />
            ) : (
              <Play size={16} className="ml-0.5" />
            )}
          </button>
        </div>

        {/* Speed */}
        <div className="flex items-center gap-1">
          {SPEED_OPTIONS.map((rate) => (
            <button
              key={rate}
              onClick={() => setPlaybackRate(rate)}
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors",
                playbackRate === rate
                  ? "bg-forensic-blue/20 text-forensic-blue"
                  : "text-ash hover:text-bone",
              )}
            >
              {rate}x
            </button>
          ))}
        </div>

        {/* Volume */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Volume2 size={12} className="text-evidence-gold" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={volumeA}
              onChange={(e) => setVolumeA(parseFloat(e.target.value))}
              className="w-16 h-1 accent-evidence-gold"
              aria-label="Volume Track A"
            />
          </div>
          <div className="flex items-center gap-1">
            <Volume2 size={12} className="text-forensic-blue" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={volumeB}
              onChange={(e) => setVolumeB(parseFloat(e.target.value))}
              className="w-16 h-1 accent-forensic-blue"
              aria-label="Volume Track B"
            />
          </div>
        </div>
      </div>

      {/* Dimension Region Filter */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-t border-slate/30 flex-wrap">
        <span className="text-[10px] text-ash uppercase tracking-wide mr-1">
          Regions:
        </span>
        {DIM_TABS.map((dim) => {
          const count =
            dim === "all"
              ? evidence.length
              : evidence.filter((e) => e.dimension === dim).length;
          if (dim !== "all" && count === 0) return null;
          const color = dim !== "all" ? DIMENSION_COLORS[dim] : undefined;
          return (
            <button
              key={dim}
              onClick={() => onDimensionChange(dim)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                activeDimension === dim
                  ? "bg-graphite text-bone"
                  : "text-ash hover:text-bone",
              )}
              style={
                activeDimension === dim && color
                  ? { borderBottom: `2px solid ${color}` }
                  : undefined
              }
            >
              {dim === "all"
                ? "All"
                : (DIMENSION_LABELS[dim] ?? dim)}
              <span className="ml-0.5 opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Evidence Quick-Play */}
      {topEvidence.length > 0 && (
        <div className="px-4 py-2 border-t border-slate/30">
          <span className="text-[10px] text-ash uppercase tracking-wide block mb-1.5">
            Evidence Quick-Play
          </span>
          <div className="space-y-1 max-h-[140px] overflow-y-auto">
            {topEvidence.map((ev) => {
              const color = DIMENSION_COLORS[ev.dimension] ?? "#8A8A8E";
              const isActive = playingEvidence === ev.id;
              const trans = ev.detail?.transposition_name as
                | string
                | undefined;

              return (
                <button
                  key={ev.id}
                  onClick={() => playEvidencePair(ev)}
                  disabled={!isReady}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors",
                    isActive
                      ? "bg-forensic-blue/10"
                      : "hover:bg-graphite/50",
                    !isReady && "opacity-30",
                  )}
                >
                  {isActive ? (
                    <Loader2
                      size={11}
                      className="animate-spin shrink-0"
                      style={{ color }}
                    />
                  ) : (
                    <Play
                      size={11}
                      className="shrink-0"
                      style={{ color }}
                    />
                  )}
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[10px] text-bone font-mono">
                    {(ev.similarity_score * 100).toFixed(0)}%
                  </span>
                  <span className="text-[10px] text-ash">
                    {formatTime(ev.source_start_sec)} (A){" "}
                    {"\u2194"}{" "}
                    {formatTime(ev.target_start_sec)} (B)
                  </span>
                  {trans && trans !== "Same key" && (
                    <span className="text-[10px] text-evidence-gold ml-auto">
                      {trans}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
