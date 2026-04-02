"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Activity, TrendingUp, Target, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { getRiskConfig, type RiskLevel } from "@/lib/config/risk-config";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

interface StatsOverviewProps {
  analyses: Array<{
    id: string;
    status: string;
    match_count: number;
    overall_risk: string | null;
    overall_score: number | null;
    created_at: string;
  }>;
  credits: { balance: number; plan_tier: string } | null;
  className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Map a risk level string to a numeric score (0-100 scale). */
function riskToNumeric(risk: string | null): number | null {
  if (!risk) return null;
  const map: Record<string, number> = {
    clear: 5,
    low: 20,
    moderate: 45,
    high: 70,
    critical: 92,
  };
  return map[risk] ?? null;
}

/** Get the risk level label for a numeric average. */
function numericToRiskLevel(score: number): RiskLevel {
  if (score <= 10) return "clear";
  if (score <= 30) return "low";
  if (score <= 55) return "moderate";
  if (score <= 80) return "high";
  return "critical";
}

/** Check if a date string falls within a given month (0-indexed). */
function isInMonth(dateStr: string, year: number, month: number): boolean {
  const d = new Date(dateStr);
  return d.getFullYear() === year && d.getMonth() === month;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function StatsOverview({ analyses, credits, className }: StatsOverviewProps) {
  const t = useTranslations("dashboard.stats");

  // ── Derived metrics ───────────────────────────────────────────────────
  const {
    thisMonthCount,
    monthDelta,
    matchRate,
    avgRiskScore,
    avgRiskLevel,
    sparklineData,
    completedCount,
  } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Previous month (handle January -> December of previous year)
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const thisMonthItems = analyses.filter((a) =>
      isInMonth(a.created_at, currentYear, currentMonth)
    );
    const lastMonthItems = analyses.filter((a) =>
      isInMonth(a.created_at, prevYear, prevMonth)
    );

    const thisMonthCount = thisMonthItems.length;
    const lastMonthCount = lastMonthItems.length;

    // Delta: percentage change, clamped for display
    let monthDelta = 0;
    if (lastMonthCount > 0) {
      monthDelta = Math.round(
        ((thisMonthCount - lastMonthCount) / lastMonthCount) * 100
      );
    } else if (thisMonthCount > 0) {
      monthDelta = 100; // all new
    }

    // Completed analyses for risk/match calculations
    const completed = analyses.filter((a) => a.status === "completed");
    const completedCount = completed.length;

    // Match rate: percentage of completed analyses with at least 1 match
    const withMatches = completed.filter((a) => a.match_count > 0).length;
    const matchRate =
      completedCount > 0 ? Math.round((withMatches / completedCount) * 100) : null;

    // Average risk score
    const riskScores = completed
      .map((a) => a.overall_score ?? riskToNumeric(a.overall_risk))
      .filter((s): s is number => s !== null);

    const avgRiskScore =
      riskScores.length > 0
        ? Math.round(riskScores.reduce((sum, s) => sum + s, 0) / riskScores.length)
        : null;

    const avgRiskLevel = avgRiskScore !== null ? numericToRiskLevel(avgRiskScore) : null;

    // Sparkline: daily analysis counts for the current month
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const dayCounts = new Array(daysInMonth).fill(0);
    for (const a of thisMonthItems) {
      const day = new Date(a.created_at).getDate();
      dayCounts[day - 1]++;
    }
    // Only show up to today
    const today = now.getDate();
    const sparklineData = dayCounts.slice(0, today).map((count, i) => ({
      day: i + 1,
      count,
    }));

    return {
      thisMonthCount,
      lastMonthCount,
      monthDelta,
      matchRate,
      avgRiskScore,
      avgRiskLevel,
      sparklineData,
      completedCount,
    };
  }, [analyses]);

  // ── Risk color resolution ─────────────────────────────────────────────
  const riskConfig = avgRiskLevel ? getRiskConfig(avgRiskLevel) : null;

  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4",
        className
      )}
    >
      {/* ── Card 1: This Month vs Last Month ─────────────────────────── */}
      <div className="bg-carbon border border-slate rounded-md p-4 flex flex-col justify-between">
        <div className="flex items-center gap-3 mb-2">
          <Activity size={18} className="text-forensic-blue" />
          <span className="text-xs text-ash font-medium">
            {t("analysesThisMonth")}
          </span>
        </div>
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-2xl font-semibold text-bone font-mono">
              {thisMonthCount}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {monthDelta > 0 ? (
                <ArrowUpRight size={12} className="text-risk-low" />
              ) : monthDelta < 0 ? (
                <ArrowDownRight size={12} className="text-signal-red" />
              ) : (
                <Minus size={12} className="text-ash" />
              )}
              <span
                className={cn(
                  "text-xs font-mono",
                  monthDelta > 0 && "text-risk-low",
                  monthDelta < 0 && "text-signal-red",
                  monthDelta === 0 && "text-ash"
                )}
              >
                {monthDelta > 0 ? "+" : ""}
                {monthDelta}%
              </span>
              <span className="text-xs text-ash ml-1">
                {t("monthComparison")}
              </span>
            </div>
          </div>
          {/* Sparkline */}
          {sparklineData.length > 1 && (
            <div className="w-20 h-10 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineData}>
                  <defs>
                    <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2E6CE6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#2E6CE6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#2E6CE6"
                    strokeWidth={1.5}
                    fill="url(#sparkGrad)"
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Card 2: Match Rate ───────────────────────────────────────── */}
      <div className="bg-carbon border border-slate rounded-md p-4">
        <div className="flex items-center gap-3 mb-2">
          <Target size={18} className="text-evidence-gold" />
          <span className="text-xs text-ash font-medium">
            {t("matchRate")}
          </span>
        </div>
        <div className="text-2xl font-semibold text-bone font-mono">
          {matchRate !== null ? `${matchRate}%` : t("noData")}
        </div>
        <div className="mt-2">
          {matchRate !== null && (
            <div className="w-full h-1.5 bg-slate rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  matchRate >= 60
                    ? "bg-signal-red"
                    : matchRate >= 30
                      ? "bg-risk-moderate"
                      : "bg-risk-low"
                )}
                style={{ width: `${matchRate}%` }}
              />
            </div>
          )}
          <p className="text-xs text-ash mt-1.5">
            {completedCount > 0
              ? `${completedCount} completed`
              : t("noData")}
          </p>
        </div>
      </div>

      {/* ── Card 3: Average Risk Score ───────────────────────────────── */}
      <div className="bg-carbon border border-slate rounded-md p-4">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp
            size={18}
            className={riskConfig?.tailwindText ?? "text-ash"}
          />
          <span className="text-xs text-ash font-medium">
            {t("averageRisk")}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-bone font-mono">
            {avgRiskScore !== null ? avgRiskScore : t("noData")}
          </span>
          {avgRiskLevel && riskConfig && (
            <span
              className={cn(
                "text-xs font-medium px-1.5 py-0.5 rounded",
                riskConfig.tailwindText,
                riskConfig.tailwindBg
              )}
            >
              {riskConfig.label}
            </span>
          )}
        </div>
        {avgRiskScore !== null && (
          <div className="mt-2 w-full h-1.5 bg-slate rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                riskConfig?.tailwindBg?.replace("/10", "") ?? "bg-ash"
              )}
              style={{
                width: `${avgRiskScore}%`,
                backgroundColor: riskConfig?.color,
              }}
            />
          </div>
        )}
      </div>

      {/* ── Card 4: Credits Balance ──────────────────────────────────── */}
      <div className="bg-carbon border border-slate rounded-md p-4">
        <div className="flex items-center gap-3 mb-2">
          <Activity size={18} className="text-forensic-blue" />
          <span className="text-xs text-ash font-medium">
            {t("creditsRemaining")}
          </span>
        </div>
        <div className="text-2xl font-semibold text-bone font-mono">
          {credits?.balance ?? 0}
        </div>
        {credits?.plan_tier && (
          <p className="text-xs text-ash mt-1.5 uppercase tracking-wide">
            {credits.plan_tier}
          </p>
        )}
      </div>
    </div>
  );
}
