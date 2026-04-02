"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { RiskBadge } from "./risk-badge";
import { EvidenceList } from "./evidence-list";
import { ChevronDown, ExternalLink } from "lucide-react";
import dynamic from "next/dynamic";

// Lazy load heavy visualization components
const DimensionRadar = dynamic(
  () => import("@/components/visualizations/dimension-radar").then(m => ({ default: m.DimensionRadar })),
  { ssr: false, loading: () => <div className="w-50 h-50 bg-graphite rounded animate-pulse" /> }
);
const EvidenceTimeline = dynamic(
  () => import("@/components/visualizations/evidence-timeline").then(m => ({ default: m.EvidenceTimeline })),
  { ssr: false }
);
const SimilarityHeatmap = dynamic(
  () => import("@/components/visualizations/similarity-heatmap").then(m => ({ default: m.SimilarityHeatmap })),
  { ssr: false }
);

interface MatchCardProps {
  match: {
    id: string;
    reference_track_id: string | null;
    compared_analysis_id: string | null;
    score_overall: number;
    score_melody: number | null;
    score_harmony: number | null;
    score_rhythm: number | null;
    score_timbre: number | null;
    risk_level: string;
    rights_holders: Record<string, unknown> | null;
    dtw_alignment: Record<string, unknown> | null;
    temporal_offset_sec: number | null;
  };
  referenceTitle: string;
  referenceArtist: string;
  evidence: Array<{
    dimension: string;
    similarity_score: number;
    source_start_sec: number;
    source_end_sec: number;
    target_start_sec: number;
    target_end_sec: number;
    description: string | null;
    detail: Record<string, unknown>;
  }>;
  sourceDuration: number;
  rank: number;
  className?: string;
}

export function MatchCard({
  match,
  referenceTitle,
  referenceArtist,
  evidence,
  sourceDuration,
  rank,
  className,
}: MatchCardProps) {
  const [heatmapExpanded, setHeatmapExpanded] = useState(false);

  const composers = match.rights_holders
    ? (match.rights_holders.composers as Array<{ name: string }>)?.map(c => c.name).join(", ")
    : null;
  const publishers = match.rights_holders
    ? (match.rights_holders.publishers as Array<{ name: string }>)?.map(p => p.name).join(", ")
    : null;

  return (
    <div className={cn("bg-carbon border border-slate rounded-lg overflow-hidden", className)}>
      {/* Header */}
      <div className="p-5 border-b border-slate/50">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-ash">Match {rank}</span>
              <RiskBadge level={match.risk_level} score={match.score_overall} size="sm" />
            </div>
            <h3 className="text-lg font-semibold text-bone">
              &ldquo;{referenceTitle}&rdquo;
            </h3>
            <p className="text-sm text-ash">{referenceArtist}</p>
          </div>
        </div>
      </div>

      {/* Radar + Timeline */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
        <DimensionRadar
          scores={{
            melody: match.score_melody,
            harmony: match.score_harmony,
            rhythm: match.score_rhythm,
            timbre: match.score_timbre,
          }}
          overallScore={match.score_overall}
          riskLevel={match.risk_level}
          size={200}
        />
        <div className="min-w-0">
          <h4 className="text-xs font-medium text-ash mb-2 uppercase tracking-wide">
            Evidence Timeline
          </h4>
          <EvidenceTimeline
            duration={sourceDuration}
            evidence={evidence}
          />
        </div>
      </div>

      {/* Dimension Scores */}
      <div className="px-5 pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Melody", score: match.score_melody, color: "#2E6CE6" },
            { label: "Harmony", score: match.score_harmony, color: "#C4992E" },
            { label: "Rhythm", score: match.score_rhythm, color: "#E63926" },
            { label: "Timbre", score: match.score_timbre, color: "#8A8A8E" },
          ].map(({ label, score, color }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-ash">{label}</span>
                <span className="text-xs font-mono text-bone">
                  {score != null ? `${Math.round(score * 100)}%` : "N/A"}
                </span>
              </div>
              <div className="h-1.5 bg-graphite rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.round((score ?? 0) * 100)}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rights Holders */}
      {(composers || publishers) && (
        <div className="px-5 pb-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ash">
          {composers && <span>Composers: <span className="text-bone">{composers}</span></span>}
          {publishers && <span>Publishers: <span className="text-bone">{publishers}</span></span>}
          {(match.rights_holders?.musicbrainzUrl as string | undefined) && (
            <a
              href={match.rights_holders?.musicbrainzUrl as string}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-forensic-blue hover:underline"
            >
              MusicBrainz <ExternalLink size={10} />
            </a>
          )}
        </div>
      )}

      {/* Heatmap (expandable) */}
      <div className="border-t border-slate/50">
        <button
          onClick={() => setHeatmapExpanded(!heatmapExpanded)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-graphite/20 transition-colors"
        >
          <span className="text-xs font-medium text-ash">
            Similarity Heatmap
          </span>
          <ChevronDown
            size={14}
            className={cn("text-ash transition-transform", heatmapExpanded && "rotate-180")}
          />
        </button>
        {heatmapExpanded && (
          <div className="px-5 pb-5">
            <SimilarityHeatmap
              evidence={evidence}
              width={560}
              height={400}
            />
          </div>
        )}
      </div>

      {/* Evidence List */}
      <div className="border-t border-slate/50 px-5 py-4">
        <h4 className="text-xs font-medium text-ash mb-3 uppercase tracking-wide">
          Key Evidence
        </h4>
        <EvidenceList evidence={evidence} maxItems={5} />
      </div>
    </div>
  );
}
