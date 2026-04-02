"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown } from "lucide-react";
import dynamic from "next/dynamic";
import type { MatchEvidenceRow } from "@/types/database";

type Dimension = "melody" | "harmony" | "rhythm" | "timbre" | "lyrics";

const SegmentAlignmentTable = dynamic(
  () =>
    import("./segment-alignment-table").then((m) => ({
      default: m.SegmentAlignmentTable,
    })),
  { ssr: false },
);
const EvidenceTimelineVisual = dynamic(
  () =>
    import("./evidence-timeline-visual").then((m) => ({
      default: m.EvidenceTimelineVisual,
    })),
  { ssr: false },
);

interface MatchEvidenceSectionProps {
  matchId: string;
  titleA: string;
  titleB: string;
  durationA: number;
  durationB: number;
  audioUrlA?: string | null;
  audioUrlB?: string | null;
  overallScore: number;
  defaultExpanded?: boolean;
  className?: string;
}

export function MatchEvidenceSection({
  matchId,
  titleA,
  titleB,
  durationA,
  durationB,
  audioUrlA,
  audioUrlB,
  overallScore,
  defaultExpanded = false,
  className,
}: MatchEvidenceSectionProps) {
  const t = useTranslations("segmentAlignment");
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [activeDimension, setActiveDimension] = useState<Dimension | "all">(
    "all",
  );
  const [evidence, setEvidence] = useState<MatchEvidenceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [activeResolution, setActiveResolution] = useState<
    "bar" | "phrase" | "song" | "max"
  >("max");

  // WaveSurfer refs for segment playback
  const wsRefA = useRef<any>(null);
  const wsRefB = useRef<any>(null);
  const timerRefA = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRefB = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playingA, setPlayingA] = useState<{
    startSec: number;
    endSec: number;
  } | null>(null);
  const [playingB, setPlayingB] = useState<{
    startSec: number;
    endSec: number;
  } | null>(null);

  // Fetch evidence on first expand
  useEffect(() => {
    if (expanded && !loaded) {
      setLoading(true);
      (async () => {
        try {
          const supabase = createClient();
          const { data } = await supabase
            .from("match_evidence")
            .select("*")
            .eq("match_id", matchId)
            .order("similarity_score", { ascending: false });
          setEvidence((data as MatchEvidenceRow[]) ?? []);
        } catch {
          // Evidence fetch failed — show empty state
        } finally {
          setLoaded(true);
          setLoading(false);
        }
      })();
    }
  }, [expanded, loaded, matchId]);

  // Segment playback handlers
  const playSegmentA = useCallback(
    (startSec: number, durationSec: number) => {
      if (timerRefA.current) clearTimeout(timerRefA.current);
      if (timerRefB.current) {
        clearTimeout(timerRefB.current);
        wsRefB.current?.pause();
        setPlayingB(null);
      }

      const ws = wsRefA.current;
      if (!ws || durationA <= 0) return;

      const endSec = Math.min(startSec + durationSec, durationA);
      ws.seekTo(Math.max(0, Math.min(1, startSec / durationA)));
      ws.play();
      setPlayingA({ startSec, endSec });

      timerRefA.current = setTimeout(() => {
        ws.pause();
        setPlayingA(null);
      }, (endSec - startSec) * 1000);
    },
    [durationA],
  );

  const playSegmentB = useCallback(
    (startSec: number, durationSec: number) => {
      if (timerRefB.current) clearTimeout(timerRefB.current);
      if (timerRefA.current) {
        clearTimeout(timerRefA.current);
        wsRefA.current?.pause();
        setPlayingA(null);
      }

      const ws = wsRefB.current;
      if (!ws || durationB <= 0) return;

      const endSec = Math.min(startSec + durationSec, durationB);
      ws.seekTo(Math.max(0, Math.min(1, startSec / durationB)));
      ws.play();
      setPlayingB({ startSec, endSec });

      timerRefB.current = setTimeout(() => {
        ws.pause();
        setPlayingB(null);
      }, (endSec - startSec) * 1000);
    },
    [durationB],
  );

  // Scroll to evidence row when clicking timeline segment
  const handleSegmentClick = useCallback((evidenceId: string) => {
    setHighlightedId(evidenceId);
    const el = document.getElementById(`evidence-${evidenceId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // Clear highlight after 3s
    setTimeout(() => setHighlightedId(null), 3000);
  }, []);

  return (
    <div className={cn("border border-slate/50 rounded-lg overflow-hidden", className)}>
      {/* Collapse/Expand Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-graphite/20 transition-colors"
      >
        <span className="text-xs font-medium text-ash uppercase tracking-wide">
          {t("title")}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            "text-ash transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="space-y-4 p-4 pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-forensic-blue border-t-transparent rounded-full animate-spin" />
            </div>
          ) : evidence.length === 0 ? (
            <p className="text-sm text-ash text-center py-8">
              {t("noEvidence", {
                score: `${Math.round(overallScore * 100)}%`,
              })}
            </p>
          ) : (
            <>
              {/* Resolution Tabs */}
              {(() => {
                const resolutions = Array.from(
                  new Set(evidence.map((e) => e.resolution).filter(Boolean)),
                );
                const hasMultiRes = resolutions.length > 1;

                // Filter evidence by resolution
                const filteredEvidence =
                  activeResolution === "max"
                    ? evidence
                    : evidence.filter(
                        (e) => e.resolution === activeResolution,
                      );

                return (
                  <>
                    {hasMultiRes && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-ash uppercase tracking-wide mr-1">
                          {t("resolution.label")}:
                        </span>
                        {(
                          [
                            { key: "max", label: t("resolution.max") },
                            { key: "bar", label: t("resolution.bar") },
                            { key: "phrase", label: t("resolution.phrase") },
                            { key: "song", label: t("resolution.song") },
                          ] as const
                        )
                          .filter(
                            ({ key }) =>
                              key === "max" ||
                              resolutions.includes(key),
                          )
                          .map(({ key, label }) => (
                            <button
                              key={key}
                              onClick={() => setActiveResolution(key)}
                              className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                                activeResolution === key
                                  ? "bg-forensic-blue/20 text-forensic-blue"
                                  : "text-ash hover:text-bone hover:bg-graphite/50",
                              )}
                            >
                              {label}
                            </button>
                          ))}
                      </div>
                    )}

                    {/* Timeline Visual */}
                    <EvidenceTimelineVisual
                      evidence={filteredEvidence}
                      durationA={durationA}
                      durationB={durationB}
                      titleA={titleA}
                      titleB={titleB}
                      activeDimension={activeDimension}
                      onSegmentClick={handleSegmentClick}
                    />

                    {/* Alignment Table */}
                    <SegmentAlignmentTable
                      evidence={filteredEvidence}
                      matchId={matchId}
                      activeDimension={activeDimension}
                      onDimensionChange={setActiveDimension}
                      onPlayA={audioUrlA ? playSegmentA : undefined}
                      onPlayB={audioUrlB ? playSegmentB : undefined}
                      playingA={playingA}
                      playingB={playingB}
                      audioAvailableA={!!audioUrlA}
                      audioAvailableB={!!audioUrlB}
                      highlightedEvidenceId={highlightedId}
                    />
                  </>
                );
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
}
