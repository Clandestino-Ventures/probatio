"use client";

/**
 * PROBATIO — Clearance Report Display
 *
 * Shows the pre-release clearance results: overall status,
 * matched tracks with dimension scores, and recommendations.
 */

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ShieldCheck, ShieldAlert, ShieldX, Download, Hash, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui";
import { RiskBadge } from "./risk-badge";
import type { AnalysisMatchRow, RiskLevel } from "@/types/database";

interface ClearanceReportProps {
  analysisId: string;
  fileName: string;
  clearanceStatus: string | null;
  overallRisk: RiskLevel | null;
  overallScore: number | null;
  matchCount: number;
  matches: AnalysisMatchRow[];
  pipelineVersion: string | null;
  createdAt: string;
  reportHash: string | null;
  monitoringEnabled?: boolean;
  isEnterprise?: boolean;
  className?: string;
}

const STATUS_CONFIG = {
  cleared: {
    icon: ShieldCheck,
    label: "CLEARED",
    color: "text-risk-low",
    bg: "bg-risk-low/10 border-risk-low/30",
    description: "No significant matches found. Safe to release.",
  },
  conditional: {
    icon: ShieldAlert,
    label: "CONDITIONAL",
    color: "text-evidence-gold",
    bg: "bg-evidence-gold/10 border-evidence-gold/30",
    description: "Moderate matches detected. Review before release.",
  },
  blocked: {
    icon: ShieldX,
    label: "BLOCKED",
    color: "text-signal-red",
    bg: "bg-signal-red/10 border-signal-red/30",
    description: "High-similarity matches found. Do not release without clearance.",
  },
} as const;

function MonitoringToggle({
  analysisId,
  initialEnabled,
}: {
  analysisId: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis_id: analysisId,
          enabled: !enabled,
        }),
      });
      if (res.ok) {
        setEnabled(!enabled);
      }
    } finally {
      setLoading(false);
    }
  }, [analysisId, enabled]);

  return (
    <div className="flex items-center justify-between p-4 bg-carbon border border-slate rounded-lg">
      <div className="flex items-center gap-3">
        {enabled ? (
          <Eye size={18} className="text-forensic-blue" />
        ) : (
          <EyeOff size={18} className="text-ash" />
        )}
        <div>
          <p className="text-sm font-medium text-bone">
            {enabled ? "Monitoring Active" : "Continuous Monitoring"}
          </p>
          <p className="text-xs text-ash">
            {enabled
              ? "This track is re-scanned weekly as new tracks are added to your catalogs."
              : "Enable to automatically re-scan when new tracks are added to your catalogs."}
          </p>
        </div>
      </div>
      <Button
        variant={enabled ? "outline" : "primary"}
        size="sm"
        onClick={toggle}
        disabled={loading}
      >
        {enabled ? "Disable" : "Enable"}
      </Button>
    </div>
  );
}

export function ClearanceReport({
  analysisId,
  fileName,
  clearanceStatus,
  overallRisk,
  overallScore,
  matchCount,
  matches,
  pipelineVersion,
  createdAt,
  reportHash,
  monitoringEnabled,
  isEnterprise,
  className,
}: ClearanceReportProps) {
  const status = STATUS_CONFIG[clearanceStatus as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.cleared;
  const StatusIcon = status.icon;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="bg-carbon border border-slate rounded-lg p-6">
        <p className="font-mono text-xs uppercase tracking-wider text-ash/60 mb-3">
          PRE-RELEASE CLEARANCE REPORT
        </p>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl text-bone">{fileName}</h2>
            <p className="text-xs text-ash mt-1">
              {new Date(createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              {pipelineVersion && ` · Pipeline v${pipelineVersion}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(`/api/reports/${analysisId}/clearance-pdf`, "_blank")
              }
            >
              <Download size={14} />
              Full Report
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(`/api/reports/${analysisId}/certificate`, "_blank")
              }
              title="Single-page certificate with QR verification code"
            >
              <Download size={14} />
              Certificate
            </Button>
          </div>
        </div>
      </div>

      {/* Clearance Status */}
      <div className={cn("flex items-center gap-4 p-5 rounded-lg border", status.bg)}>
        <StatusIcon size={32} className={status.color} />
        <div>
          <p className={cn("text-lg font-display font-medium", status.color)}>
            {status.label}
          </p>
          <p className="text-sm text-ash">{status.description}</p>
        </div>
      </div>

      {/* Monitoring Toggle */}
      {isEnterprise && (
        <MonitoringToggle
          analysisId={analysisId}
          initialEnabled={monitoringEnabled ?? false}
        />
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-carbon border border-slate rounded-md p-4 text-center">
          <p className="text-2xl font-display text-bone">{matchCount}</p>
          <p className="text-xs text-ash mt-1">Matches Found</p>
        </div>
        <div className="bg-carbon border border-slate rounded-md p-4 text-center">
          <p className="text-2xl font-display text-bone">
            {overallScore != null ? `${Math.round(overallScore * 100)}%` : "—"}
          </p>
          <p className="text-xs text-ash mt-1">Highest Similarity</p>
        </div>
        <div className="bg-carbon border border-slate rounded-md p-4 text-center">
          <RiskBadge level={overallRisk ?? "low"} size="lg" />
          <p className="text-xs text-ash mt-1">Risk Level</p>
        </div>
      </div>

      {/* Match List */}
      {matches.length > 0 ? (
        <div className="space-y-3">
          <h3 className="font-mono text-xs uppercase tracking-wider text-ash/60">
            POTENTIAL CONFLICTS ({matches.length})
          </h3>
          {matches.map((match, i) => (
            <div
              key={match.id}
              className="bg-carbon border border-slate rounded-md p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-bone">
                    Match {i + 1}
                  </p>
                  <p className="text-xs text-ash mt-0.5">
                    Reference Track ID: {match.reference_track_id}
                  </p>
                </div>
                <RiskBadge level={match.risk_level} />
              </div>

              {/* Dimension Scores */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Melody", score: match.score_melody },
                  { label: "Harmony", score: match.score_harmony },
                  { label: "Rhythm", score: match.score_rhythm },
                  { label: "Timbre", score: match.score_timbre },
                ].map((dim) => (
                  <div key={dim.label} className="text-center">
                    <p className="text-lg font-mono text-bone">
                      {Math.round((dim.score ?? 0) * 100)}%
                    </p>
                    <p className="text-xs text-ash">{dim.label}</p>
                  </div>
                ))}
              </div>

              {/* Overall */}
              <div className="flex items-center justify-between pt-2 border-t border-slate/50">
                <span className="text-xs text-ash">Overall Similarity</span>
                <span className="text-sm font-mono font-medium text-bone">
                  {Math.round((match.score_overall ?? 0) * 100)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-carbon border border-slate rounded-md p-8 text-center">
          <ShieldCheck size={32} className="text-risk-low mx-auto mb-3" />
          <p className="text-sm text-bone font-medium">
            No matches above screening threshold
          </p>
          <p className="text-xs text-ash mt-1">
            Your track did not match any reference tracks in the scanned catalogs.
          </p>
        </div>
      )}

      {/* Verification Hash */}
      {reportHash && (
        <div className="flex items-center gap-2 px-1">
          <Hash size={12} className="text-ash/40" />
          <span className="text-xs font-mono text-ash/40 truncate">
            SHA-256: {reportHash}
          </span>
        </div>
      )}
    </div>
  );
}
