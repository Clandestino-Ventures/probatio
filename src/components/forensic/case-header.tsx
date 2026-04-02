"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { RiskBadge } from "@/components/analysis/risk-badge";
import { Button } from "@/components/ui";
import { ArrowLeft, Download, FileArchive, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface CaseHeaderProps {
  caseId: string;
  caseName: string;
  caseNumber: string | null;
  plaintiff: string | null;
  defendant: string | null;
  jurisdiction: string | null;
  riskLevel: string | null;
  overallScore: number | null;
  status: string;
  createdAt: string;
  className?: string;
}

export function CaseHeader({
  caseId,
  caseName,
  caseNumber,
  plaintiff,
  defendant,
  jurisdiction,
  riskLevel,
  overallScore,
  status,
  createdAt,
  className,
}: CaseHeaderProps) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingEvidence, setDownloadingEvidence] = useState(false);

  const isCompleted = status === "completed";

  async function downloadPdf() {
    // Forensic reports use the track_a analysis ID for now
    // In future: dedicated forensic report endpoint
    setDownloadingPdf(true);
    try {
      toast.info("Forensic PDF report generation coming soon");
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function downloadEvidence() {
    setDownloadingEvidence(true);
    try {
      toast.info("Evidence package export coming soon");
    } finally {
      setDownloadingEvidence(false);
    }
  }

  return (
    <div className={cn("bg-carbon border border-slate rounded-lg p-5", className)}>
      {/* Back link */}
      <Link
        href="/dashboard/forensic"
        className="inline-flex items-center gap-1 text-xs text-ash hover:text-bone transition-colors mb-4"
      >
        <ArrowLeft size={12} />
        Back to Forensic Cases
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-bone mb-1">{caseName}</h1>
          <div className="flex items-center gap-3 text-xs text-ash flex-wrap">
            {caseNumber && <span>{caseNumber}</span>}
            {jurisdiction && (
              <>
                <span className="w-px h-3 bg-slate" />
                <span>{jurisdiction}</span>
              </>
            )}
            {(plaintiff || defendant) && (
              <>
                <span className="w-px h-3 bg-slate" />
                <span>
                  {plaintiff && defendant
                    ? `${plaintiff} v. ${defendant}`
                    : plaintiff || defendant}
                </span>
              </>
            )}
            <span className="w-px h-3 bg-slate" />
            <span>{new Date(createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {riskLevel && isCompleted && (
            <RiskBadge level={riskLevel} score={overallScore ?? undefined} size="lg" />
          )}
        </div>
      </div>

      {/* Export buttons */}
      {isCompleted && (
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate/50">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadPdf}
            loading={downloadingPdf}
          >
            <Download size={14} />
            Download Forensic Report
          </Button>
          <Button
            variant="gold"
            size="sm"
            onClick={downloadEvidence}
            loading={downloadingEvidence}
          >
            <FileArchive size={14} />
            Export Evidence Package
          </Button>
        </div>
      )}
    </div>
  );
}
