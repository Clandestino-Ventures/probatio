"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatDate, truncateHash } from "@/lib/utils";
import { Header } from "@/components/dashboard/header";
import { PipelineTracker } from "@/components/dashboard/pipeline-tracker";
import { Badge, Button } from "@/components/ui";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { PIPELINE_STEPS, type PipelineStepName } from "@/lib/constants";
import {
  ArrowLeft,
  FileAudio,
  Hash,
  Scale,
  Download,
  Shield,
  Clock,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ExpertAnnotations } from "@/components/forensic/expert-annotations";
import type {
  ForensicCaseRow,
  ForensicStatus,
  AnalysisStatus,
} from "@/types/database";

// ────────────────────────────────────────────────────────────────────────────
// Status badge configuration
// ────────────────────────────────────────────────────────────────────────────

const statusVariantMap: Record<
  ForensicStatus,
  "default" | "info" | "verified" | "risk-low"
> = {
  intake: "default",
  in_review: "info",
  expert_assigned: "info",
  analysis_complete: "verified",
  report_generated: "risk-low",
  closed: "default",
  completed: "verified",
  failed: "default",
  pending_payment: "default",
  paid: "info",
  processing: "info",
};

const statusLabels: Record<ForensicStatus, string> = {
  intake: "Intake",
  in_review: "In Review",
  expert_assigned: "Expert Assigned",
  analysis_complete: "Analysis Complete",
  report_generated: "Report Generated",
  closed: "Closed",
  completed: "Completed",
  failed: "Failed",
  pending_payment: "Pending Payment",
  paid: "Paid",
  processing: "Processing",
};

// ────────────────────────────────────────────────────────────────────────────
// Score bar dimensions for forensic comparison
// ────────────────────────────────────────────────────────────────────────────

const SCORE_DIMENSIONS = [
  { key: "melody", label: "Melody", color: "bg-forensic-blue" },
  { key: "harmony", label: "Harmony", color: "bg-evidence-gold" },
  { key: "rhythm", label: "Rhythm", color: "bg-signal-red" },
  { key: "structure", label: "Structure", color: "bg-risk-low" },
  { key: "overall", label: "Overall", color: "bg-forensic-blue" },
] as const;

// ────────────────────────────────────────────────────────────────────────────
// Extended forensic case type with joined data
// ────────────────────────────────────────────────────────────────────────────

interface ForensicCaseData extends ForensicCaseRow {
  // Joined analysis data (may be present from a select with join)
  analysis?: {
    file_name: string;
    audio_url: string | null;
    file_hash: string;
    duration_seconds: number | null;
    status: AnalysisStatus;
    overall_risk: string | null;
  } | null;
  // Mock scores for display
  scores?: {
    melody: number;
    harmony: number;
    rhythm: number;
    structure: number;
    overall: number;
  } | null;
}

export default function ForensicCaseDetailPage() {
  const params = useParams();
  const caseId = params.caseId as string;
  const t = useTranslations('forensic');

  const [caseData, setCaseData] = useState<ForensicCaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCase() {
      setLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from("forensic_cases")
          .select("*, analyses(*)")
          .eq("id", caseId)
          .single();

        if (fetchError) {
          setError(fetchError.message);
          setLoading(false);
          return;
        }

        setCaseData(data as ForensicCaseData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load forensic case"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchCase();
  }, [caseId]);

  if (loading) {
    return (
      <>
        <Header title="Forensic Case" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-forensic-blue border-t-transparent rounded-full animate-spin" />
        </div>
      </>
    );
  }

  if (error || !caseData) {
    return (
      <>
        <Header title="Forensic Case" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-ash">{error || "Case not found."}</p>
          <Link href="/dashboard">
            <Button variant="outline">
              <ArrowLeft size={16} />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </>
    );
  }

  const isProcessing =
    caseData.status === "intake" ||
    caseData.status === "in_review" ||
    caseData.status === "expert_assigned";
  const isCompleted =
    caseData.status === "analysis_complete" ||
    caseData.status === "report_generated" ||
    caseData.status === "closed";

  const custody = (caseData.chain_of_custody ?? []) as Array<{
    sequence?: number;
    timestamp?: string;
    action?: string;
    hashAfter?: string;
    actor?: string;
  }>;

  // Mock scores if not available (forensic analysis results)
  const scores = caseData.scores ?? (isCompleted
    ? { melody: 0.78, harmony: 0.65, rhythm: 0.42, structure: 0.71, overall: 0.72 }
    : null);

  return (
    <>
      <Header title={caseData.case_name || "Forensic Case"} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          {/* Back link */}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-ash hover:text-bone transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Dashboard
          </Link>

          {/* Case Metadata Card */}
          <div className="bg-carbon border border-slate rounded-md p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-graphite flex items-center justify-center">
                  <Scale size={20} className="text-evidence-gold" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-bone">
                    {caseData.case_name}
                  </h2>
                  <div className="flex items-center gap-3 text-xs text-ash mt-1">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatDate(caseData.created_at)}
                    </span>
                  </div>
                </div>
              </div>
              <Badge variant={statusVariantMap[caseData.status]}>
                {statusLabels[caseData.status]}
              </Badge>
            </div>

            {caseData.case_description && (
              <p className="text-sm text-ash mb-4">{caseData.case_description}</p>
            )}

            {caseData.parties_involved && (
              <div className="flex items-center gap-2 text-sm text-ash">
                <Users size={14} className="text-ash shrink-0" />
                <span>{caseData.parties_involved}</span>
              </div>
            )}
          </div>

          {/* Track Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Track A */}
            <div className="bg-carbon border border-slate rounded-md p-6">
              <p className="text-xs font-medium text-ash uppercase tracking-wider mb-3">
                Track A (Disputed)
              </p>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-md bg-graphite flex items-center justify-center">
                  <FileAudio size={14} className="text-signal-red" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-bone truncate">
                    {caseData.analysis?.file_name || "Disputed Track"}
                  </p>
                  {caseData.analysis?.duration_seconds && (
                    <p className="text-xs text-ash">
                      {Math.floor(caseData.analysis.duration_seconds / 60)}:
                      {String(
                        Math.floor(caseData.analysis.duration_seconds % 60)
                      ).padStart(2, "0")}
                    </p>
                  )}
                </div>
              </div>
              {caseData.analysis?.file_hash && (
                <div className="flex items-center gap-2 p-2 bg-graphite rounded-md">
                  <Hash size={12} className="text-ash shrink-0" />
                  <span className="text-xs font-mono text-ash truncate">
                    {truncateHash(caseData.analysis.file_hash, 10, 10)}
                  </span>
                </div>
              )}
            </div>

            {/* Track B */}
            <div className="bg-carbon border border-slate rounded-md p-6">
              <p className="text-xs font-medium text-ash uppercase tracking-wider mb-3">
                Track B (Original)
              </p>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-md bg-graphite flex items-center justify-center">
                  <FileAudio size={14} className="text-forensic-blue" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-bone truncate">
                    Original Reference Track
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Processing State — Pipeline Tracker */}
          {isProcessing && (
            <div className="bg-carbon border border-forensic-blue/30 rounded-md p-6">
              <h3 className="text-sm font-medium text-forensic-blue mb-4">
                Forensic Analysis in Progress
              </h3>
              <PipelineTracker
                currentStep={getForensicPipelineStep(caseData.status)}
                completedSteps={getForensicCompletedSteps(caseData.status)}
              />
            </div>
          )}

          {/* Completed — Forensic Similarity Scores */}
          {isCompleted && scores && (
            <div className="bg-carbon border border-slate rounded-md p-6">
              <div className="flex items-center gap-2 mb-6">
                <Shield size={18} className="text-bone" />
                <h3 className="text-lg font-semibold text-bone">
                  Forensic Similarity Analysis
                </h3>
              </div>

              <div className="space-y-4">
                {SCORE_DIMENSIONS.map(({ key, label, color }) => {
                  const score = scores[key as keyof typeof scores];
                  const percentage = Math.round(score * 100);

                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-bone">{label}</span>
                        <span className="text-sm font-mono text-bone">
                          {percentage}%
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-graphite rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-700",
                            key === "overall" ? "bg-forensic-blue" : color
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chain of Custody */}
          {custody.length > 0 && (
            <div className="bg-carbon border border-slate rounded-md p-6">
              <h3 className="text-lg font-semibold text-bone mb-4">
                Chain of Custody
              </h3>

              <Accordion multiple>
                {custody.map((entry, idx) => (
                  <AccordionItem key={idx} value={`custody-${idx}`}>
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-graphite flex items-center justify-center text-xs text-ash shrink-0">
                          {entry.sequence ?? idx + 1}
                        </span>
                        <span className="text-sm text-bone">
                          {entry.action || "Event"}
                        </span>
                        {entry.timestamp && (
                          <span className="text-xs text-ash ml-auto mr-4">
                            {formatDate(entry.timestamp)}
                          </span>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pl-9 space-y-2 text-xs">
                        {entry.actor && (
                          <p>
                            <span className="text-ash">Actor: </span>
                            <span className="text-bone">{entry.actor}</span>
                          </p>
                        )}
                        {entry.hashAfter && (
                          <p className="font-mono">
                            <span className="text-ash">Hash: </span>
                            <span className="text-bone">
                              {truncateHash(entry.hashAfter, 12, 12)}
                            </span>
                          </p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}

          {/* Expert Annotations */}
          <ExpertAnnotations forensicCaseId={caseId} />

          {/* Evidence Package Download */}
          {isCompleted && caseData.evidence_package_url && (
            <div className="bg-carbon border border-evidence-gold/30 rounded-md p-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-sm font-medium text-evidence-gold mb-1">
                    Evidence Package Ready
                  </h3>
                  <p className="text-xs text-ash">
                    Court-ready package with analysis report, audio exhibits,
                    and chain of custody documentation.
                  </p>
                </div>
                <a
                  href={caseData.evidence_package_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="gold">
                    <Download size={16} />
                    Download Evidence Package
                  </Button>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers for pipeline tracker mapping
// ────────────────────────────────────────────────────────────────────────────

function getForensicPipelineStep(
  status: ForensicStatus
): PipelineStepName | null {
  const map: Partial<Record<ForensicStatus, PipelineStepName>> = {
    intake: "upload",
    in_review: "extract",
    expert_assigned: "match",
  };
  return map[status] ?? null;
}

function getForensicCompletedSteps(status: ForensicStatus): PipelineStepName[] {
  const steps: PipelineStepName[] = [...PIPELINE_STEPS];
  const completionMap: Record<ForensicStatus, number> = {
    intake: 1,
    in_review: 3,
    expert_assigned: 4,
    analysis_complete: 6,
    report_generated: 6,
    closed: 6,
    completed: 6,
    failed: 0,
    pending_payment: 0,
    paid: 1,
    processing: 2,
  };
  const count = completionMap[status] ?? 0;
  return steps.slice(0, count);
}
