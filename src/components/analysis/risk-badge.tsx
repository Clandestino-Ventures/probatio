"use client";

import { cn } from "@/lib/utils";
import { getRiskConfig } from "@/lib/config/risk-config";

interface RiskBadgeProps {
  level: string;
  score?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function RiskBadge({ level, score, size = "md", className }: RiskBadgeProps) {
  const config = getRiskConfig(level);

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded-md",
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: config.bgColor, color: config.color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: config.color }}
      />
      {config.label}
      {score != null && (
        <span className="opacity-75">
          {Math.round(score * 100)}%
        </span>
      )}
    </span>
  );
}
