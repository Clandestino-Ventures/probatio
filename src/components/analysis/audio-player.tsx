"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Play, Pause, SkipBack } from "lucide-react";
import { DIMENSION_COLORS } from "@/lib/config/risk-config";

interface EvidenceRegion {
  dimension: string;
  startSec: number;
  endSec: number;
  similarity: number;
}

interface AudioPlayerProps {
  audioUrl: string | null;        // Signed URL — null if not available
  duration: number;
  evidence?: EvidenceRegion[];
  activeSegment?: { startSec: number; endSec: number } | null;
  onTimeUpdate?: (currentTime: number) => void;
  onSegmentClick?: (startSec: number, endSec: number) => void;
  className?: string;
}

export function AudioPlayer({
  audioUrl,
  duration,
  evidence = [],
  activeSegment,
  onTimeUpdate,
  onSegmentClick,
  className,
}: AudioPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // Format time as M:SS
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Initialize wavesurfer
  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;

    let ws: any;

    const initWavesurfer = async () => {
      // Dynamic import to avoid SSR issues
      const WaveSurfer = (await import("wavesurfer.js")).default;

      ws = WaveSurfer.create({
        container: containerRef.current!,
        waveColor: "#3A3A3F",        // slate
        progressColor: "#2E6CE6",    // forensic-blue
        cursorColor: "#F5F0EB",      // bone
        cursorWidth: 1,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 64,
        normalize: true,
        url: audioUrl,
        backend: "WebAudio",
      });

      ws.on("ready", () => {
        setIsReady(true);
        wavesurferRef.current = ws;
      });

      ws.on("timeupdate", (time: number) => {
        setCurrentTime(time);
        onTimeUpdate?.(time);
      });

      ws.on("play", () => setIsPlaying(true));
      ws.on("pause", () => setIsPlaying(false));
      ws.on("finish", () => setIsPlaying(false));
    };

    initWavesurfer().catch(console.error);

    return () => {
      ws?.destroy();
      wavesurferRef.current = null;
      setIsReady(false);
    };
  }, [audioUrl]);

  // Seek to active segment when it changes
  useEffect(() => {
    if (wavesurferRef.current && activeSegment && isReady) {
      const ws = wavesurferRef.current;
      ws.seekTo(activeSegment.startSec / duration);
      ws.play();
    }
  }, [activeSegment, duration, isReady]);

  const togglePlay = useCallback(() => {
    wavesurferRef.current?.playPause();
  }, []);

  const restart = useCallback(() => {
    wavesurferRef.current?.seekTo(0);
  }, []);

  // Fallback for when audio URL is not available
  if (!audioUrl) {
    return (
      <div className={cn("bg-carbon border border-slate rounded-lg p-4", className)}>
        <p className="text-sm text-ash text-center">
          Audio playback not available. Upload the original file to enable playback.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("bg-carbon border border-slate rounded-lg overflow-hidden", className)}>
      {/* Controls bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate/50">
        <button
          onClick={restart}
          className="text-ash hover:text-bone transition-colors"
          disabled={!isReady}
        >
          <SkipBack size={14} />
        </button>
        <button
          onClick={togglePlay}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-forensic-blue text-bone hover:bg-forensic-blue/90 transition-colors disabled:opacity-50"
          disabled={!isReady}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </button>
        <span className="text-xs font-mono text-ash">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Waveform container */}
      <div className="relative px-4 py-3">
        <div ref={containerRef} />

        {/* Evidence region overlay markers (positioned above the waveform) */}
        {isReady && evidence.length > 0 && (
          <div className="absolute top-0 left-4 right-4 h-2 flex">
            {evidence.map((ev, i) => {
              const left = (ev.startSec / duration) * 100;
              const width = Math.max(((ev.endSec - ev.startSec) / duration) * 100, 0.5);
              const color = DIMENSION_COLORS[ev.dimension] ?? "#8A8A8E";
              return (
                <div
                  key={i}
                  className="absolute h-2 rounded-sm cursor-pointer hover:opacity-100 transition-opacity"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    backgroundColor: color,
                    opacity: 0.4 + ev.similarity * 0.6,
                  }}
                  onClick={() => onSegmentClick?.(ev.startSec, ev.endSec)}
                  title={`${ev.dimension}: ${Math.round(ev.similarity * 100)}%`}
                />
              );
            })}
          </div>
        )}

        {!isReady && (
          <div className="h-16 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-forensic-blue border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Evidence marker legend */}
      {evidence.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 border-t border-slate/50">
          {Object.entries(
            evidence.reduce<Record<string, number>>((acc, ev) => {
              acc[ev.dimension] = (acc[ev.dimension] ?? 0) + 1;
              return acc;
            }, {})
          ).map(([dim, count]) => (
            <div key={dim} className="flex items-center gap-1 text-[10px] text-ash">
              <div
                className="w-2 h-2 rounded-sm"
                style={{ backgroundColor: DIMENSION_COLORS[dim] ?? "#8A8A8E" }}
              />
              <span className="capitalize">{dim} ({count})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
