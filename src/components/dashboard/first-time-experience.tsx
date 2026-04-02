"use client";

import { cn } from "@/lib/utils";
import { UploadZone } from "@/components/analysis/upload-zone";
import { FileAudio, Zap, FileText } from "lucide-react";
import type { PlanTier } from "@/types/database";

interface FirstTimeExperienceProps {
  creditBalance: number;
  planTier: PlanTier;
  firstName: string | null;
  onAnalysisCreated: (id: string) => void;
  className?: string;
}

export function FirstTimeExperience({
  creditBalance,
  planTier,
  firstName,
  onAnalysisCreated,
  className,
}: FirstTimeExperienceProps) {
  const creditMessage =
    planTier === "enterprise"
      ? "You have unlimited analyses"
      : planTier === "free"
        ? `You have ${creditBalance} free analyses to get started`
        : `You have ${creditBalance} analyses this month`;

  return (
    <div className={cn("max-w-2xl mx-auto py-8", className)}>
      <div className="text-center mb-8">
        <h1 className="font-display text-3xl text-bone mb-2">
          Welcome to Probatio{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-ash text-base">
          Upload your first track to scan for potential copyright similarities.
        </p>
      </div>

      {/* Upload zone — prominent */}
      <div className="mb-10">
        <UploadZone
          mode="screening"
          onAnalysisCreated={onAnalysisCreated}
        />
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        {[
          {
            icon: FileAudio,
            title: "1. Upload",
            description: "Drop an audio file — MP3, WAV, FLAC, or AIFF",
          },
          {
            icon: Zap,
            title: "2. Analyze",
            description: "Probatio scans melody, harmony, rhythm, and timbre",
          },
          {
            icon: FileText,
            title: "3. Report",
            description: "Receive a forensic report with similarity findings",
          },
        ].map(({ icon: Icon, title, description }) => (
          <div key={title} className="text-center">
            <div className="w-10 h-10 rounded-full bg-graphite flex items-center justify-center mx-auto mb-3">
              <Icon size={18} className="text-forensic-blue" />
            </div>
            <h3 className="text-sm font-medium text-bone mb-1">{title}</h3>
            <p className="text-xs text-ash">{description}</p>
          </div>
        ))}
      </div>

      <p className="text-center text-sm text-ash">
        <span className="text-bone font-medium">{creditMessage}</span>.
      </p>
    </div>
  );
}
