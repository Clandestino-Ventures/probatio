"use client";

import { useRef, useState, useCallback } from "react";
import { AudioPlayer } from "@/components/analysis/audio-player";
import { cn } from "@/lib/utils";
import { Play, Pause, Hash } from "lucide-react";
import { Button } from "@/components/ui";

interface TrackInfo {
  label: string;         // "Track A (Subject Work)" or "Track B (Reference Work)"
  fileName: string;
  audioUrl: string | null;
  duration: number;
  hash: string;
  tempo: number | null;
  key: string | null;
}

interface EvidenceRegion {
  dimension: string;
  startSec: number;
  endSec: number;
  similarity: number;
}

interface SideBySidePlayersProps {
  trackA: TrackInfo;
  trackB: TrackInfo;
  evidenceA?: EvidenceRegion[];   // Evidence markers on Track A
  evidenceB?: EvidenceRegion[];   // Evidence markers on Track B
  activeSegmentA?: { startSec: number; endSec: number } | null;
  activeSegmentB?: { startSec: number; endSec: number } | null;
  onTimeUpdateA?: (time: number) => void;
  onTimeUpdateB?: (time: number) => void;
  className?: string;
}

// Helper to truncate hash
function truncHash(hash: string): string {
  return hash.length > 16 ? `${hash.slice(0, 8)}...${hash.slice(-8)}` : hash;
}

export function SideBySidePlayers({
  trackA,
  trackB,
  evidenceA = [],
  evidenceB = [],
  activeSegmentA,
  activeSegmentB,
  onTimeUpdateA,
  onTimeUpdateB,
  className,
}: SideBySidePlayersProps) {
  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-4", className)}>
      {/* Track A */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-evidence-gold uppercase tracking-wide">
              {trackA.label}
            </span>
            <h3 className="text-sm font-medium text-bone">{trackA.fileName}</h3>
          </div>
          <div className="text-right text-[10px] text-ash space-y-0.5">
            {trackA.tempo && <div>{Math.round(trackA.tempo)} BPM</div>}
            {trackA.key && <div>{trackA.key}</div>}
          </div>
        </div>

        <AudioPlayer
          audioUrl={trackA.audioUrl}
          duration={trackA.duration}
          evidence={evidenceA}
          activeSegment={activeSegmentA}
          onTimeUpdate={onTimeUpdateA}
        />

        <div className="flex items-center gap-1.5 text-[10px] text-ash">
          <Hash size={10} />
          <span className="font-mono">{truncHash(trackA.hash)}</span>
        </div>
      </div>

      {/* Track B */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-forensic-blue uppercase tracking-wide">
              {trackB.label}
            </span>
            <h3 className="text-sm font-medium text-bone">{trackB.fileName}</h3>
          </div>
          <div className="text-right text-[10px] text-ash space-y-0.5">
            {trackB.tempo && <div>{Math.round(trackB.tempo)} BPM</div>}
            {trackB.key && <div>{trackB.key}</div>}
          </div>
        </div>

        <AudioPlayer
          audioUrl={trackB.audioUrl}
          duration={trackB.duration}
          evidence={evidenceB}
          activeSegment={activeSegmentB}
          onTimeUpdate={onTimeUpdateB}
        />

        <div className="flex items-center gap-1.5 text-[10px] text-ash">
          <Hash size={10} />
          <span className="font-mono">{truncHash(trackB.hash)}</span>
        </div>
      </div>
    </div>
  );
}
