"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuthStore, useFirstName } from "@/stores/auth-store";
import { useAnalysisStore } from "@/stores/analysis-store";
import { Header } from "@/components/dashboard/header";
import { UploadZone } from "@/components/analysis/upload-zone";
import { AnalysisCard } from "@/components/dashboard/analysis-card";
import { ActiveAnalysisCard } from "@/components/dashboard/active-analysis-card";
import { FirstTimeExperience } from "@/components/dashboard/first-time-experience";
import { StatsOverview } from "@/components/dashboard/stats-overview";
import {
  AnalysisModeSelector,
  type AnalysisModeSelection,
} from "@/components/dashboard/analysis-mode-selector";
import { CatalogSelector } from "@/components/dashboard/catalog-selector";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { AnalysisStatus, RiskLevel } from "@/types/database";
import type { AnalysisListItem } from "@/types/api";

export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const { creditBalance, planTier } = useAuthStore();
  const firstName = useFirstName();
  const { analysisList, fetchAnalysisList, loading } = useAnalysisStore();
  const [mounted, setMounted] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<AnalysisModeSelection>("screening");
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<string[]>([]);
  const [includePlatformLibrary, setIncludePlatformLibrary] = useState(true);

  useEffect(() => {
    setMounted(true);
    fetchAnalysisList(1, 50);
  }, [fetchAnalysisList]);

  const allAnalyses: AnalysisListItem[] = analysisList ?? [];

  const activeAnalyses = useMemo(
    () =>
      allAnalyses.filter(
        (a: AnalysisListItem) => !["completed", "failed"].includes(a.status)
      ),
    [allAnalyses]
  );

  const attentionAnalyses = useMemo(
    () =>
      allAnalyses
        .filter(
          (a: AnalysisListItem) =>
            a.status === "completed" &&
            (a.overallRisk === "high" || a.overallRisk === "critical")
        )
        .sort((a: AnalysisListItem, b: AnalysisListItem) => {
          const riskOrder: Record<string, number> = { critical: 2, high: 1 };
          return (riskOrder[b.overallRisk ?? ""] ?? 0) - (riskOrder[a.overallRisk ?? ""] ?? 0);
        }),
    [allAnalyses]
  );

  const recentAnalyses = useMemo(
    () =>
      allAnalyses
        .filter((a: AnalysisListItem) => a.status === "completed" || a.status === "failed")
        .slice(0, 10),
    [allAnalyses]
  );

  const isFirstTime = !loading && allAnalyses.length === 0;

  if (!mounted) return null;

  const displayName = firstName || "";

  // First-time experience (no analyses yet — but still show correct name/credits)
  if (isFirstTime) {
    return (
      <>
        <Header title={displayName ? t("welcome", { name: displayName }) : "Dashboard"} />
        <div className="flex-1 overflow-y-auto">
          <FirstTimeExperience
            creditBalance={creditBalance}
            planTier={planTier}
            firstName={firstName}
            onAnalysisCreated={(id) => router.push(`/dashboard/analyses/${id}`)}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title={displayName ? t("welcome", { name: displayName }) : "Dashboard"}
        activeCount={activeAnalyses.length}
        attentionCount={attentionAnalyses.length}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 lg:py-8 space-y-6 lg:space-y-8">
          {/* Stats Overview */}
          {allAnalyses.length > 0 && (
            <StatsOverview
              analyses={allAnalyses.map((a: AnalysisListItem) => ({
                id: a.id,
                status: a.status,
                match_count: a.matchCount,
                overall_risk: a.overallRisk,
                overall_score: null,
                created_at: a.createdAt,
              }))}
              credits={
                creditBalance != null
                  ? { balance: creditBalance, plan_tier: planTier }
                  : null
              }
            />
          )}

          {/* Analysis Mode Selector */}
          <div data-tour="mode-selector">
            <AnalysisModeSelector
              selected={analysisMode}
              onSelect={setAnalysisMode}
            />
          </div>

          {/* Catalog Selector (clearance mode only) */}
          {analysisMode === "clearance" && (
            <CatalogSelector
              selectedIds={selectedCatalogIds}
              onSelectionChange={setSelectedCatalogIds}
              includePlatformLibrary={includePlatformLibrary}
              onPlatformLibraryChange={setIncludePlatformLibrary}
            />
          )}

          {/* Upload Zone */}
          <div data-tour="upload-zone">
            <UploadZone
              mode={analysisMode === "clearance" ? "clearance" : "screening"}
              catalogIds={analysisMode === "clearance" ? selectedCatalogIds : undefined}
              onAnalysisCreated={(id) => router.push(`/dashboard/analyses/${id}`)}
            />
          </div>

          {/* Active Now */}
          {activeAnalyses.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-ash uppercase tracking-wide mb-3">
                Active Now ({activeAnalyses.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeAnalyses.map((analysis: AnalysisListItem) => (
                  <ActiveAnalysisCard
                    key={analysis.id}
                    analysis={{
                      id: analysis.id,
                      file_name: analysis.title,
                      title: analysis.title,
                      status: analysis.status,
                      current_step: null,
                      progress_pct: 0,
                      mode: analysis.mode,
                      created_at: analysis.createdAt,
                    }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Needs Attention */}
          {attentionAnalyses.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-signal-red uppercase tracking-wide mb-3">
                Needs Attention ({attentionAnalyses.length})
              </h2>
              <div className="space-y-2">
                {attentionAnalyses.map((analysis: AnalysisListItem) => (
                  <AnalysisCard
                    key={analysis.id}
                    id={analysis.id}
                    fileName={analysis.title}
                    status={analysis.status as AnalysisStatus}
                    overallRisk={analysis.overallRisk as RiskLevel | null}
                    matchCount={analysis.matchCount}
                    durationSeconds={null}
                    createdAt={analysis.createdAt}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Recent */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-ash uppercase tracking-wide">
                Recent
              </h2>
              <Link
                href="/dashboard/history"
                className="flex items-center gap-1 text-xs text-forensic-blue hover:text-forensic-blue/80 transition-colors"
              >
                View all
                <ArrowRight size={12} />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-carbon border border-slate rounded-md p-4 h-20 animate-pulse"
                  />
                ))}
              </div>
            ) : recentAnalyses.length > 0 ? (
              <div className="space-y-2">
                {recentAnalyses.map((analysis: AnalysisListItem) => (
                  <AnalysisCard
                    key={analysis.id}
                    id={analysis.id}
                    fileName={analysis.title}
                    status={analysis.status as AnalysisStatus}
                    overallRisk={analysis.overallRisk as RiskLevel | null}
                    matchCount={analysis.matchCount}
                    durationSeconds={null}
                    createdAt={analysis.createdAt}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-carbon border border-slate rounded-md p-8 text-center">
                <p className="text-ash text-sm">No completed analyses yet.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
