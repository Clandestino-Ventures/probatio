"use client";

import { useEffect, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Header } from "@/components/dashboard/header";
import { AnalysisCard } from "@/components/dashboard/analysis-card";
import { useAnalysisStore } from "@/stores/analysis-store";
import { Button, Input } from "@/components/ui";
import { Search, ChevronLeft, ChevronRight, FileX } from "lucide-react";
import type { AnalysisStatus, RiskLevel } from "@/types/database";

const STATUS_OPTIONS_KEYS = [
  { value: "all", labelKey: "all" },
  { value: "pending", labelKey: "pending" },
  { value: "completed", labelKey: "completed" },
  { value: "failed", labelKey: "failed" },
];

const RISK_OPTIONS_KEYS = [
  { value: "all", labelKey: "all" },
  { value: "low", labelKey: "low" },
  { value: "moderate", labelKey: "moderate" },
  { value: "high", labelKey: "high" },
  { value: "critical", labelKey: "critical" },
];

const PER_PAGE = 10;

export default function HistoryPage() {
  const t = useTranslations('pipeline.status');
  const tRisk = useTranslations('risk.levels');
  const tDashboard = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const {
    analysisList,
    totalCount,
    listLoading,
    fetchAnalysisList,
  } = useAnalysisStore();

  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");

  useEffect(() => {
    const status =
      statusFilter === "all" ? undefined : (statusFilter as AnalysisStatus);
    fetchAnalysisList(page, PER_PAGE, status);
  }, [page, statusFilter, fetchAnalysisList]);

  // Client-side filtering for search and risk (server handles status + pagination)
  const filteredList = useMemo(() => {
    let list = analysisList ?? [];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((a) => a.title.toLowerCase().includes(q));
    }

    if (riskFilter !== "all") {
      list = list.filter((a) => a.overallRisk === riskFilter);
    }

    return list;
  }, [analysisList, searchQuery, riskFilter]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));

  return (
    <>
      <Header title={tDashboard('recentAnalyses.title')} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1 w-full sm:max-w-sm">
              <Input
                placeholder={tCommon('search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                startIcon={<Search size={16} />}
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className={cn(
                  "h-10 px-3 rounded-md text-sm text-bone",
                  "bg-graphite border border-slate",
                  "focus:outline-none focus:ring-2 focus:ring-forensic-blue focus:ring-offset-1 focus:ring-offset-obsidian",
                  "appearance-none cursor-pointer pr-8"
                )}
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8A8E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 0.75rem center",
                }}
              >
                {STATUS_OPTIONS_KEYS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.value === 'all' ? 'All Statuses' : t(opt.labelKey)}
                  </option>
                ))}
              </select>

              <select
                value={riskFilter}
                onChange={(e) => {
                  setRiskFilter(e.target.value);
                  setPage(1);
                }}
                className={cn(
                  "h-10 px-3 rounded-md text-sm text-bone",
                  "bg-graphite border border-slate",
                  "focus:outline-none focus:ring-2 focus:ring-forensic-blue focus:ring-offset-1 focus:ring-offset-obsidian",
                  "appearance-none cursor-pointer pr-8"
                )}
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8A8E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 0.75rem center",
                }}
              >
                {RISK_OPTIONS_KEYS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.value === 'all' ? 'All Risk Levels' : tRisk(`${opt.labelKey}.label`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Analysis List */}
          {listLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-carbon border border-slate rounded-md p-4 h-20 animate-pulse"
                />
              ))}
            </div>
          ) : filteredList.length > 0 ? (
            <div className="space-y-3">
              {filteredList.map((analysis) => (
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
            <div className="bg-carbon border border-slate rounded-md p-16 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-graphite flex items-center justify-center">
                  <FileX size={20} className="text-ash" />
                </div>
                <p className="text-bone font-medium">{tCommon('noResults')}</p>
                <p className="text-sm text-ash max-w-sm">
                  {searchQuery || statusFilter !== "all" || riskFilter !== "all"
                    ? "Try adjusting your filters to find what you're looking for."
                    : tDashboard('recentAnalyses.empty')}
                </p>
              </div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate">
              <p className="text-sm text-ash">
                Page {page} of {totalPages}{" "}
                <span className="text-ash/60">
                  ({totalCount} total {totalCount === 1 ? "analysis" : "analyses"})
                </span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
