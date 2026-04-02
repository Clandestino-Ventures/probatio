"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { formatDate, formatDuration } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { Clock, FileAudio, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import type { RiskLevel, AnalysisStatus } from "@/types/database";

interface AnalysisCardProps {
  id: string;
  fileName: string;
  status: AnalysisStatus;
  overallRisk: RiskLevel | null;
  matchCount: number;
  durationSeconds: number | null;
  createdAt: string;
  className?: string;
}

const riskVariantMap: Record<string, "risk-low" | "risk-medium" | "risk-high" | "risk-critical" | "default"> = {
  low: "risk-low",
  medium: "risk-medium",
  high: "risk-high",
  critical: "risk-critical",
};

function getStatusConfig(status: AnalysisStatus, statusLabels: Record<string, string>) {
  const configs: Record<string, { icon: React.ReactNode; color: string }> = {
    queued: {
      icon: <Clock size={12} />,
      color: "text-ash",
    },
    completed: {
      icon: <CheckCircle size={12} />,
      color: "text-risk-low",
    },
    failed: {
      icon: <AlertTriangle size={12} />,
      color: "text-signal-red",
    },
  };

  if (status === "completed" || status === "failed" || status === "pending") {
    const cfg = configs[status];
    return {
      label: statusLabels[status] || status,
      icon: cfg?.icon ?? <Clock size={12} />,
      color: cfg?.color ?? "text-ash",
    };
  }
  return {
    label: statusLabels.uploading || "Processing",
    icon: <Loader2 size={12} className="animate-spin" />,
    color: "text-forensic-blue",
  };
}

export function AnalysisCard({
  id,
  fileName,
  status,
  overallRisk,
  matchCount,
  durationSeconds,
  createdAt,
  className,
}: AnalysisCardProps) {
  const tStatus = useTranslations('pipeline.status');
  const statusLabels: Record<string, string> = {
    pending: tStatus('pending'),
    queued: tStatus('pending'),
    uploading: tStatus('uploading'),
    completed: tStatus('completed'),
    failed: tStatus('failed'),
  };
  const statusCfg = getStatusConfig(status, statusLabels);

  return (
    <Link href={`/dashboard/analyses/${id}`}>
      <div
        className={cn(
          "bg-carbon border border-slate rounded-md p-4 hover:border-slate/80 hover:bg-carbon/80 transition-colors cursor-pointer",
          className
        )}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileAudio size={16} className="text-ash shrink-0" />
            <span className="text-sm font-medium text-bone truncate">
              {fileName}
            </span>
          </div>
          {overallRisk && status === "completed" && (
            <Badge variant={riskVariantMap[overallRisk] || "default"}>
              {overallRisk.charAt(0).toUpperCase() + overallRisk.slice(1)}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-ash">
          <span className={cn("flex items-center gap-1", statusCfg.color)}>
            {statusCfg.icon}
            {statusCfg.label}
          </span>
          {status === "completed" && (
            <span>
              {matchCount} {matchCount === 1 ? "match" : "matches"}
            </span>
          )}
          {durationSeconds && <span>{formatDuration(durationSeconds)}</span>}
          <span className="ml-auto">{formatDate(createdAt, "short")}</span>
        </div>
      </div>
    </Link>
  );
}
