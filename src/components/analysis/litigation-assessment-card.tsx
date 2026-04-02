"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge, Button } from "@/components/ui";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui";
import {
  Scale,
  ChevronDown,
  Shield,
  ShieldAlert,
  ShieldX,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  RotateCw,
  BookOpen,
  Gavel,
  Target,
  XCircle,
} from "lucide-react";
import type { LitigationRisk } from "@/lib/report/litigation-assessment";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface LitigationAssessmentData {
  overallRisk: LitigationRisk;
  litigationProbability: string;
  mostSimilarPrecedent: {
    name: string;
    citation: string;
    ruling: string;
    whySimilar: string;
  };
  additionalPrecedents: Array<{
    name: string;
    citation: string;
    relevance: string;
  }>;
  arnsteinAnalysis: {
    extrinsicTest: string;
    intrinsicTest: string;
    conclusion: string;
  };
  strengths: string[];
  weaknesses: string[];
  potentialDefenses: Array<{
    defense: string;
    applicability: "strong" | "moderate" | "weak";
    explanation: string;
  }>;
  recommendations: string[];
  fullNarrative: string;
  assessmentConfidence: "high" | "medium" | "low";
  confidenceReason: string;
}

interface LitigationAssessmentCardProps {
  analysisId: string;
  assessment: LitigationAssessmentData | null;
  onRegenerate?: () => void;
}

// ────────────────────────────────────────────────────────────────────────────
// Risk configuration
// ────────────────────────────────────────────────────────────────────────────

const RISK_CONFIG: Record<
  LitigationRisk,
  {
    icon: typeof Shield;
    badge: "risk-low" | "risk-medium" | "risk-high" | "risk-critical";
    bg: string;
    border: string;
    text: string;
  }
> = {
  low: {
    icon: ShieldCheck,
    badge: "risk-low",
    bg: "bg-risk-low/5",
    border: "border-risk-low/30",
    text: "text-risk-low",
  },
  moderate: {
    icon: ShieldAlert,
    badge: "risk-medium",
    bg: "bg-risk-moderate/5",
    border: "border-risk-moderate/30",
    text: "text-risk-moderate",
  },
  high: {
    icon: ShieldX,
    badge: "risk-high",
    bg: "bg-risk-high/5",
    border: "border-risk-high/30",
    text: "text-risk-high",
  },
  very_high: {
    icon: ShieldX,
    badge: "risk-critical",
    bg: "bg-risk-critical/5",
    border: "border-risk-critical/30",
    text: "text-risk-critical",
  },
};

const DEFENSE_BADGE: Record<string, "risk-low" | "risk-medium" | "risk-high"> = {
  strong: "risk-low",
  moderate: "risk-medium",
  weak: "risk-high",
};

const CONFIDENCE_BADGE: Record<string, "risk-low" | "risk-medium" | "risk-high"> = {
  high: "risk-low",
  medium: "risk-medium",
  low: "risk-high",
};

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function LitigationAssessmentCard({
  analysisId,
  assessment,
  onRegenerate,
}: LitigationAssessmentCardProps) {
  const t = useTranslations("litigation");
  const [regenerating, setRegenerating] = useState(false);

  if (!assessment) return null;

  const config = RISK_CONFIG[assessment.overallRisk] ?? RISK_CONFIG.low;
  const RiskIcon = config.icon;

  const handleRegenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      const res = await fetch(
        `/api/analyses/${analysisId}/litigation-assessment`,
        { method: "POST" }
      );
      if (res.ok) {
        onRegenerate?.();
      }
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className={`bg-carbon border ${config.border} rounded-md overflow-hidden`}>
      {/* Header */}
      <div className={`${config.bg} px-6 py-4 border-b ${config.border}`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-graphite flex items-center justify-center">
              <Scale size={20} className={config.text} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-bone">
                {t("title")}
              </h3>
              <p className="text-xs text-ash">{t("subtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={config.badge}>
              {t(`risk.${assessment.overallRisk}`)}
            </Badge>
            <span className="text-lg font-display font-bold text-bone">
              {assessment.litigationProbability}
            </span>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-6">
        {/* Most Similar Precedent */}
        <div className="bg-graphite/50 border border-evidence-gold/20 rounded-md p-4">
          <div className="flex items-center gap-2 mb-2">
            <Gavel size={14} className="text-evidence-gold shrink-0" />
            <span className="text-xs font-medium text-evidence-gold uppercase tracking-wider">
              {t("precedent.title")}
            </span>
          </div>
          <p className="text-sm font-medium text-bone">
            {assessment.mostSimilarPrecedent.name}
          </p>
          <p className="text-xs font-mono text-ash mt-0.5">
            {assessment.mostSimilarPrecedent.citation}
          </p>
          <p className="text-xs text-ash mt-0.5">
            {t("precedent.ruling")}:{" "}
            <span className="text-bone capitalize">
              {assessment.mostSimilarPrecedent.ruling.replace(/_/g, " ")}
            </span>
          </p>
          <p className="text-sm text-ash mt-2 leading-relaxed">
            {assessment.mostSimilarPrecedent.whySimilar}
          </p>
        </div>

        {/* Additional Precedents */}
        {assessment.additionalPrecedents.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-ash uppercase tracking-wider">
              {t("precedent.additional")}
            </p>
            {assessment.additionalPrecedents.map((p, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <BookOpen size={12} className="text-ash shrink-0 mt-0.5" />
                <div>
                  <span className="text-bone">{p.name}</span>
                  <span className="text-ash"> ({p.citation})</span>
                  <p className="text-ash mt-0.5">{p.relevance}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Arnstein Analysis */}
        <Accordion>
          <AccordionItem value="arnstein">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Target size={14} className="text-forensic-blue" />
                <span className="text-sm font-medium text-bone">
                  {t("arnstein.title")}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs font-medium text-ash uppercase tracking-wider mb-1">
                    {t("arnstein.extrinsic")}
                  </p>
                  <p className="text-ash leading-relaxed">
                    {assessment.arnsteinAnalysis.extrinsicTest}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-ash uppercase tracking-wider mb-1">
                    {t("arnstein.intrinsic")}
                  </p>
                  <p className="text-ash leading-relaxed">
                    {assessment.arnsteinAnalysis.intrinsicTest}
                  </p>
                </div>
                <div className="bg-graphite/50 rounded-md p-3">
                  <p className="text-xs font-medium text-ash uppercase tracking-wider mb-1">
                    {t("arnstein.conclusion")}
                  </p>
                  <p className="text-bone leading-relaxed">
                    {assessment.arnsteinAnalysis.conclusion}
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Strengths */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={14} className="text-signal-red" />
              <span className="text-xs font-medium text-ash uppercase tracking-wider">
                {t("strengths.title")} ({assessment.strengths.length})
              </span>
            </div>
            <ul className="space-y-1.5">
              {assessment.strengths.map((s, i) => (
                <li key={i} className="text-xs text-ash leading-relaxed pl-4 relative">
                  <span className="absolute left-0 top-0.5 text-signal-red">+</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>

          {/* Weaknesses */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <XCircle size={14} className="text-risk-low" />
              <span className="text-xs font-medium text-ash uppercase tracking-wider">
                {t("weaknesses.title")} ({assessment.weaknesses.length})
              </span>
            </div>
            <ul className="space-y-1.5">
              {assessment.weaknesses.map((w, i) => (
                <li key={i} className="text-xs text-ash leading-relaxed pl-4 relative">
                  <span className="absolute left-0 top-0.5 text-risk-low">-</span>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Potential Defenses */}
        <Accordion>
          <AccordionItem value="defenses">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-bone" />
                <span className="text-sm font-medium text-bone">
                  {t("defenses.title")} ({assessment.potentialDefenses.length})
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {assessment.potentialDefenses.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 bg-graphite/30 rounded-md p-3"
                  >
                    <Badge
                      variant={DEFENSE_BADGE[d.applicability] ?? "default"}
                      className="shrink-0 mt-0.5"
                    >
                      {t(`defenses.applicability.${d.applicability}`)}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium text-bone">
                        {d.defense}
                      </p>
                      <p className="text-xs text-ash mt-1 leading-relaxed">
                        {d.explanation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Recommendations */}
        <Accordion>
          <AccordionItem value="recommendations">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-evidence-gold" />
                <span className="text-sm font-medium text-bone">
                  {t("recommendations.title")} ({assessment.recommendations.length})
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2">
                {assessment.recommendations.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-ash"
                  >
                    <span className="text-evidence-gold font-bold shrink-0">
                      {i + 1}.
                    </span>
                    {r}
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Assessment Confidence */}
        <div className="flex items-center justify-between pt-3 border-t border-slate">
          <div className="flex items-center gap-2">
            <span className="text-xs text-ash">
              {t("confidence.title")}:
            </span>
            <Badge variant={CONFIDENCE_BADGE[assessment.assessmentConfidence] ?? "default"}>
              {t(`confidence.${assessment.assessmentConfidence}`)}
            </Badge>
          </div>
          <p className="text-xs text-ash max-w-sm text-right">
            {assessment.confidenceReason}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate">
          <p className="text-[10px] text-ash max-w-md leading-relaxed">
            {t("disclaimer")}
          </p>
          {onRegenerate && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating}
            >
              <RotateCw
                size={14}
                className={regenerating ? "animate-spin" : ""}
              />
              {t("regenerate")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
