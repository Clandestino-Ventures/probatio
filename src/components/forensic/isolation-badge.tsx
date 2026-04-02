"use client";

import { cn } from "@/lib/utils";
import { Shield, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { useState } from "react";

interface IsolationBadgeProps {
  isolationVerified: boolean;
  conflictDetected: boolean;
  isolationGuarantee: string;
  searchScopeA?: string[];   // catalog types searched for Track A
  searchScopeB?: string[];   // catalog types searched for Track B
  className?: string;
}

export function IsolationBadge({
  isolationVerified,
  conflictDetected,
  isolationGuarantee,
  searchScopeA,
  searchScopeB,
  className,
}: IsolationBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  const variant = isolationVerified
    ? "verified"
    : conflictDetected
      ? "warning"
      : "neutral";

  const config = {
    verified: {
      icon: CheckCircle,
      text: "Data isolation verified",
      color: "text-risk-low",
      bg: "bg-risk-low/10",
    },
    warning: {
      icon: AlertTriangle,
      text: "Review isolation details",
      color: "text-risk-moderate",
      bg: "bg-risk-moderate/10",
    },
    neutral: {
      icon: Info,
      text: "Standard isolation",
      color: "text-ash",
      bg: "bg-graphite",
    },
  }[variant];

  const Icon = config.icon;

  return (
    <div className={cn("rounded-lg border border-slate", className)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors",
          config.bg, config.color
        )}
      >
        <Icon size={12} />
        {config.text}
      </button>

      {expanded && (
        <div className="px-3 py-2 border-t border-slate text-xs text-ash space-y-2">
          <p>{isolationGuarantee}</p>
          {searchScopeA && (
            <div>
              <span className="text-bone text-[10px] uppercase tracking-wide">Track A searched:</span>
              <span className="ml-1">{searchScopeA.join(", ")}</span>
            </div>
          )}
          {searchScopeB && (
            <div>
              <span className="text-bone text-[10px] uppercase tracking-wide">Track B searched:</span>
              <span className="ml-1">{searchScopeB.join(", ")}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
