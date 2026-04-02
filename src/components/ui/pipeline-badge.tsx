"use client";

import { cn } from "@/lib/utils";
import { CheckCircle, AlertTriangle } from "lucide-react";

interface PipelineBadgeProps {
  version: string;
  verified?: boolean;
  verifiedAt?: string | null;
  className?: string;
}

export function PipelineBadge({
  version,
  verified = false,
  verifiedAt,
  className,
}: PipelineBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono",
        verified
          ? "bg-risk-low/10 text-risk-low"
          : "bg-graphite text-ash",
        className
      )}
      title={
        verified && verifiedAt
          ? `Reproducibility verified via drift detection on ${new Date(verifiedAt).toLocaleDateString()}`
          : "Reproducibility not yet verified for this pipeline version"
      }
    >
      {version}
      {verified ? (
        <CheckCircle size={10} />
      ) : (
        <AlertTriangle size={10} className="text-risk-moderate" />
      )}
    </span>
  );
}
