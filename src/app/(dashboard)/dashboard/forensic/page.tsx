"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/dashboard/header";
import { RiskBadge } from "@/components/analysis/risk-badge";
import { formatRelativeTime } from "@/lib/format";
import { Plus, Scale, FileAudio, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui";
import { useAuthStore, useCanAccessForensic } from "@/stores/auth-store";

interface ForensicCase {
  id: string;
  case_name: string;
  case_number: string | null;
  plaintiff: string | null;
  defendant: string | null;
  jurisdiction: string | null;
  risk_assessment: string | null;
  status: string;
  created_at: string;
  track_a_analysis_id: string | null;
  track_b_analysis_id: string | null;
}

export default function ForensicCasesPage() {
  const router = useRouter();
  const { initialized } = useAuthStore();
  const canAccessForensic = useCanAccessForensic();
  const [cases, setCases] = useState<ForensicCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for auth store to load before checking access
    if (!initialized) return;
    if (!canAccessForensic) {
      setLoading(false);
      return;
    }
    async function fetchCases() {
      const supabase = createClient();
      const { data } = await supabase
        .from("forensic_cases")
        .select("*")
        .order("created_at", { ascending: false });

      setCases((data as ForensicCase[]) ?? []);
      setLoading(false);
    }
    fetchCases();
  }, [canAccessForensic, initialized]);

  const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: "Pending", color: "text-ash" },
    analyzing: { label: "Analyzing...", color: "text-forensic-blue" },
    completed: { label: "Completed", color: "text-risk-low" },
    archived: { label: "Archived", color: "text-ash" },
  };

  // Access gate — show upgrade prompt for free/starter users (only after store loads)
  if (initialized && !canAccessForensic) {
    return (
      <>
        <Header title="Forensic Cases" />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto px-4 py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-graphite border border-slate flex items-center justify-center mx-auto mb-6">
              <Lock size={28} className="text-ash" />
            </div>
            <h2 className="text-xl font-semibold text-bone mb-2">
              Forensic Analysis requires Professional or Enterprise
            </h2>
            <p className="text-sm text-ash mb-6">
              Upgrade your plan to access court-ready forensic comparison, DTW analysis, and evidence packaging.
            </p>
            <Link href="/dashboard/settings#plan-usage">
              <Button>View Plans</Button>
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Forensic Cases" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 lg:px-6 py-6 lg:py-8">
          {/* Header row */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm text-ash">
                Track A vs Track B comparison with full chain of custody.
              </p>
            </div>
            <Link href="/dashboard/forensic/new">
              <Button variant="primary" size="md">
                <Plus size={16} />
                New Forensic Analysis
              </Button>
            </Link>
          </div>

          {/* Cases list */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-carbon border border-slate rounded-lg p-5 h-24 animate-pulse"
                />
              ))}
            </div>
          ) : cases.length === 0 ? (
            <div className="bg-carbon border border-slate rounded-lg p-12 text-center">
              <Scale size={32} className="text-ash mx-auto mb-4" />
              <h3 className="text-bone font-medium mb-2">No forensic cases yet</h3>
              <p className="text-sm text-ash mb-6 max-w-sm mx-auto">
                Start your first forensic analysis to compare two tracks with
                full chain of custody for litigation support.
              </p>
              <Link href="/dashboard/forensic/new">
                <Button variant="primary" size="md">
                  <Plus size={16} />
                  New Forensic Analysis
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {cases.map((c) => {
                const status = statusConfig[c.status] ?? statusConfig.pending;

                return (
                  <Link key={c.id} href={`/dashboard/forensic/${c.id}`}>
                    <div className="bg-carbon border border-slate rounded-lg p-5 hover:border-slate/80 hover:bg-carbon/80 transition-colors cursor-pointer">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-sm font-semibold text-bone truncate">
                              {c.case_name}
                            </h3>
                            {c.risk_assessment && c.status === "completed" && (
                              <RiskBadge level={c.risk_assessment} size="sm" />
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-ash">
                            {c.case_number && <span>{c.case_number}</span>}
                            {c.jurisdiction && (
                              <>
                                <span className="w-px h-3 bg-slate" />
                                <span>{c.jurisdiction}</span>
                              </>
                            )}
                            <span className="w-px h-3 bg-slate" />
                            <span>{formatRelativeTime(c.created_at)}</span>
                          </div>

                          {(c.plaintiff || c.defendant) && (
                            <p className="text-xs text-ash mt-1">
                              {c.plaintiff && c.defendant
                                ? `${c.plaintiff} v. ${c.defendant}`
                                : c.plaintiff || c.defendant}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn("text-xs font-medium flex items-center gap-1", status.color)}>
                            {c.status === "analyzing" && (
                              <Loader2 size={12} className="animate-spin" />
                            )}
                            {status.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
