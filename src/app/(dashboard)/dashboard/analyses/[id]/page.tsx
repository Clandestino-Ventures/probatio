"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAnalysisStore } from "@/stores/analysis-store";
import { Header } from "@/components/dashboard/header";
import { PipelineTracker } from "@/components/dashboard/pipeline-tracker";
import { ClearanceReport } from "@/components/analysis/clearance-report";
import { Badge } from "@/components/ui";
import { Button } from "@/components/ui";
import { formatDate, formatDuration, truncateHash, formatFileSize } from "@/lib/utils";
import { PIPELINE_STEPS, type PipelineStepName } from "@/lib/constants";
import {
  FileAudio,
  Hash,
  Clock,
  Download,
  ArrowLeft,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  AlertTriangle,
  CheckCircle,
  Database,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { AnalysisRow, RiskLevel } from "@/types/database";
import { DEMO_MODE, DEMO_ANALYSES, DEMO_MATCHES } from "@/lib/demo/seed-data";

const MatchEvidenceSection = dynamic(
  () => import("@/components/analysis/match-evidence-section").then(m => ({ default: m.MatchEvidenceSection })),
  { ssr: false }
);
const ReproductionCard = dynamic(
  () => import("@/components/analysis/reproduction-card").then(m => ({ default: m.ReproductionCard })),
  { ssr: false }
);

const riskVariantMap: Record<string, "risk-low" | "risk-medium" | "risk-high" | "risk-critical"> = {
  low: "risk-low",
  medium: "risk-medium",
  moderate: "risk-medium",
  high: "risk-high",
  critical: "risk-critical",
};

const CLEARANCE_STATUS_CONFIG = {
  cleared: {
    icon: ShieldCheck,
    color: "text-risk-low",
    bg: "bg-risk-low/10 border-risk-low/30",
  },
  conditional: {
    icon: ShieldAlert,
    color: "text-risk-moderate",
    bg: "bg-risk-moderate/10 border-risk-moderate/30",
  },
  blocked: {
    icon: ShieldX,
    color: "text-signal-red",
    bg: "bg-signal-red/10 border-signal-red/30",
  },
} as const;

interface CatalogInfo {
  id: string;
  name: string;
  track_count: number;
  tracks_with_embeddings: number;
}

// Risk labels and recommendations are now sourced from translations below

export default function AnalysisDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('analysis');
  const tMatch = useTranslations('analysis.match');
  const tRisk = useTranslations('risk.levels');
  const tPipeline = useTranslations('pipeline');
  const tCommon = useTranslations('common');
  const tClearance = useTranslations('clearance.detail');
  const id = params.id as string;
  const {
    analysis,
    matches,
    loading,
    fetchAnalysis,
    fetchMatches,
    subscribeToAnalysis,
    unsubscribeFromAnalysis,
  } = useAnalysisStore();

  const [catalogNames, setCatalogNames] = useState<CatalogInfo[]>([]);
  const [catalogsLoading, setCatalogsLoading] = useState(false);

  // Build demo analysis row if in demo mode and id starts with "demo-"
  const isDemo = DEMO_MODE && id.startsWith('demo-');
  const demoListItem = isDemo
    ? DEMO_ANALYSES.find((a) => a.id === id)
    : null;
  const demoAnalysis: AnalysisRow | null = demoListItem
    ? {
        id: demoListItem.id,
        user_id: 'demo-user',
        file_name: demoListItem.title,
        mode: demoListItem.mode,
        status: demoListItem.status as AnalysisRow['status'],
        audio_url: null,
        file_hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        file_size_bytes: 48_291_840,
        duration_seconds: 214,
        stems_urls: null,
        features: null,
        embeddings: null,
        results: null,
        report: null,
        overall_risk: demoListItem.overallRisk,
        overall_score: null,
        match_count: demoListItem.matchCount,
        output_hash: null,
        pipeline_version: '1.0.0',
        current_step: null,
        processing_time_ms: 34200,
        error_message: null,
        error_step: null,
        normalization_params: null,
        progress_pct: 100,
        identified_track: null,
        normalized_audio_url: null,
        normalized_hash: null,
        lyrics_text: null,
        lyrics_language: null,
        detected_genre: null,
        genre_confidence: null,
        normalization_metrics: {
          pre: { sampleRate: 44100, channels: 2, format: "mp3", integratedLufs: -18.3 },
          post: { sampleRate: 44100, channels: 1, format: "wav", integratedLufs: -14.0, gainAppliedDb: 4.3 },
          params: { targetLufs: -14.0, standard: "EBU R128" },
        },
        audio_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        audio_deleted_at: null,
        batch_id: null,
        catalog_ids: null,
        monitoring_enabled: false,
        last_monitored_at: null,
        monitoring_catalog_ids: null,
        clearance_status: null,
        deletion_notified: false,
        deletion_notification_sent_at: null,
        created_at: demoListItem.createdAt,
        updated_at: demoListItem.completedAt ?? demoListItem.createdAt,
      }
    : null;
  const demoMatches = isDemo
    ? DEMO_MATCHES.filter((m) => m.analysis_id === id)
    : [];

  useEffect(() => {
    if (!isDemo) {
      fetchAnalysis(id);
      fetchMatches(id);

      const sub = subscribeToAnalysis(id);

      return () => {
        unsubscribeFromAnalysis();
      };
    }
  }, [id, isDemo, fetchAnalysis, fetchMatches, subscribeToAnalysis, unsubscribeFromAnalysis]);

  // Fetch catalog names when analysis is clearance mode with catalog_ids
  const resolvedAnalysis = analysis || demoAnalysis;
  useEffect(() => {
    if (
      resolvedAnalysis?.mode === "clearance" &&
      resolvedAnalysis.catalog_ids &&
      resolvedAnalysis.catalog_ids.length > 0
    ) {
      setCatalogsLoading(true);
      fetch("/api/catalogs")
        .then((res) => res.json())
        .then((data) => {
          const allCatalogs: CatalogInfo[] = data.catalogs ?? [];
          const matched = allCatalogs.filter((c: CatalogInfo) =>
            resolvedAnalysis.catalog_ids!.includes(c.id)
          );
          setCatalogNames(matched);
        })
        .catch(() => {
          setCatalogNames([]);
        })
        .finally(() => {
          setCatalogsLoading(false);
        });
    }
  }, [resolvedAnalysis?.mode, resolvedAnalysis?.catalog_ids]);

  // Resolve display data: prefer real data, fall back to demo
  const displayAnalysis = analysis || demoAnalysis;
  const displayMatches = (matches && matches.length > 0) ? matches : demoMatches;

  if (loading && !displayAnalysis) {
    return (
      <>
        <Header title="Analysis" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-forensic-blue border-t-transparent rounded-full animate-spin" />
        </div>
      </>
    );
  }

  if (!displayAnalysis) {
    return (
      <>
        <Header title="Analysis" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-ash">{t('detail.noMatches', { defaultValue: 'Analysis not found.' })}</p>
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            <ArrowLeft size={16} />
            {tCommon('back')}
          </Button>
        </div>
      </>
    );
  }

  const isProcessing =
    displayAnalysis.status !== "completed" && displayAnalysis.status !== "failed";
  const completedSteps = getCompletedSteps(displayAnalysis.status);
  const currentStep = getCurrentStep(displayAnalysis.status);

  return (
    <>
      <Header title={displayAnalysis.file_name} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          {/* Back link */}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-ash hover:text-bone transition-colors"
          >
            <ArrowLeft size={14} />
            {tCommon('back')}
          </Link>

          {/* File Info */}
          <div className="bg-carbon border border-slate rounded-md p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-graphite flex items-center justify-center">
                  <FileAudio size={20} className="text-forensic-blue" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-bone">
                    {displayAnalysis.file_name}
                  </h2>
                  <div className="flex items-center gap-4 text-xs text-ash mt-1">
                    {displayAnalysis.duration_seconds && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDuration(displayAnalysis.duration_seconds)}
                      </span>
                    )}
                    {displayAnalysis.file_size_bytes && (
                      <span>{formatFileSize(displayAnalysis.file_size_bytes)}</span>
                    )}
                    <span>{formatDate(displayAnalysis.created_at)}</span>
                  </div>
                </div>
              </div>

              {displayAnalysis.status === "completed" && (
                <Button variant="outline" size="sm">
                  <Download size={14} />
                  {t('detail.export')}
                </Button>
              )}
            </div>

            {/* Hash + Genre */}
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              {displayAnalysis.file_hash && (
                <div className="flex items-center gap-2 p-2 bg-graphite rounded-md">
                  <Hash size={14} className="text-ash shrink-0" />
                  <span className="text-xs font-mono text-ash">
                    SHA-256: {truncateHash(displayAnalysis.file_hash, 16, 16)}
                  </span>
                </div>
              )}
              {displayAnalysis.detected_genre && (
                <div className="flex items-center gap-2 p-2 bg-graphite rounded-md">
                  <span className="text-xs text-ash">Genre:</span>
                  <Badge variant="default">
                    {displayAnalysis.detected_genre}
                  </Badge>
                  {displayAnalysis.genre_confidence != null && (
                    <span className="text-[10px] font-mono text-ash">
                      {Math.round(displayAnalysis.genre_confidence * 100)}%
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Processing State */}
          {isProcessing && (
            <div className="bg-carbon border border-forensic-blue/30 rounded-md p-6">
              <h3 className="text-sm font-medium text-forensic-blue mb-4">
                {tPipeline('title')}
              </h3>
              <PipelineTracker
                currentStep={currentStep}
                completedSteps={completedSteps}
                failed={displayAnalysis.status === "failed"}
                failedStep={
                  displayAnalysis.status === "failed"
                    ? (undefined as PipelineStepName | undefined)
                    : undefined
                }
              />
            </div>
          )}

          {/* Failed State */}
          {displayAnalysis.status === "failed" && (
            <div className="bg-signal-red/5 border border-signal-red/30 rounded-md p-6">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-signal-red" />
                <h3 className="text-sm font-medium text-signal-red">
                  {tPipeline('error.title')}
                </h3>
              </div>
              <p className="text-sm text-ash">
                {displayAnalysis.error_message ||
                  tPipeline('error.description')}
              </p>
            </div>
          )}

          {/* Completed — Results */}
          {displayAnalysis.status === "completed" && (
            <>
              {/* Clearance Mode: show clearance-specific UI */}
              {displayAnalysis.mode === "clearance" ? (
                <>
                  {/* Clearance Status Badge */}
                  {(() => {
                    const statusKey = (displayAnalysis.clearance_status ?? "cleared") as keyof typeof CLEARANCE_STATUS_CONFIG;
                    const config = CLEARANCE_STATUS_CONFIG[statusKey] ?? CLEARANCE_STATUS_CONFIG.cleared;
                    const StatusIcon = config.icon;
                    return (
                      <div className={`flex items-center gap-4 p-5 rounded-lg border ${config.bg}`}>
                        <StatusIcon size={32} className={config.color} />
                        <div>
                          <p className={`text-lg font-display font-medium ${config.color}`}>
                            {tClearance(`statusBadge.${statusKey}`)}
                          </p>
                          <p className="text-sm text-ash">
                            {tClearance(`statusDescription.${statusKey}`)}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Catalogs Scanned */}
                  {displayAnalysis.catalog_ids && displayAnalysis.catalog_ids.length > 0 && (
                    <div className="bg-carbon border border-slate rounded-md p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <Database size={20} className="text-bone" />
                        <h3 className="text-lg font-semibold text-bone">
                          {tClearance('catalogsScanned')}
                        </h3>
                      </div>
                      {catalogsLoading ? (
                        <p className="text-sm text-ash">{tClearance('catalogLoading')}</p>
                      ) : catalogNames.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {catalogNames.map((catalog) => (
                            <div
                              key={catalog.id}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-graphite border border-slate rounded-md"
                            >
                              <Database size={14} className="text-ash shrink-0" />
                              <span className="text-sm text-bone">{catalog.name}</span>
                              <span className="text-xs text-ash">
                                ({catalog.tracks_with_embeddings.toLocaleString()} tracks)
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-ash">{tClearance('catalogsNone')}</p>
                      )}
                    </div>
                  )}

                  {/* Clearance Report (full component with matches) */}
                  <ClearanceReport
                    analysisId={displayAnalysis.id}
                    fileName={displayAnalysis.file_name}
                    clearanceStatus={displayAnalysis.clearance_status}
                    overallRisk={displayAnalysis.overall_risk}
                    overallScore={displayAnalysis.overall_score}
                    matchCount={displayAnalysis.match_count}
                    matches={displayMatches ?? []}
                    pipelineVersion={displayAnalysis.pipeline_version}
                    createdAt={displayAnalysis.created_at}
                    reportHash={displayAnalysis.output_hash}
                  />
                </>
              ) : (
                <>
                  {/* Standard Mode: Risk Overview */}
                  <div className="bg-carbon border border-slate rounded-md p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Shield size={20} className="text-bone" />
                      <h3 className="text-lg font-semibold text-bone">
                        {tMatch('risk')}
                      </h3>
                    </div>

                    {displayAnalysis.overall_risk && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={
                              riskVariantMap[displayAnalysis.overall_risk] || "default"
                            }
                          >
                            {tRisk(`${displayAnalysis.overall_risk}.label`, { defaultValue: displayAnalysis.overall_risk })}
                          </Badge>
                        </div>
                        <p className="text-sm text-ash">
                          {tRisk(`${displayAnalysis.overall_risk}.recommendation`, { defaultValue: '' })}
                        </p>
                      </div>
                    )}

                    {(displayMatches?.length ?? 0) === 0 && (
                      <div className="flex items-center gap-2 mt-4 p-3 bg-risk-low/5 border border-risk-low/20 rounded-md">
                        <CheckCircle size={16} className="text-risk-low" />
                        <span className="text-sm text-bone">
                          {t('detail.noMatches')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Standard Mode: Matches */}
                  {displayMatches && displayMatches.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-bone">
                        {t('detail.matches')} ({displayMatches.length})
                      </h3>
                      {displayMatches.map((match) => (
                        <div
                          key={match.id}
                          className="bg-carbon border border-slate rounded-md p-6"
                        >
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                              <h4 className="text-sm font-medium text-bone">
                                {tMatch('referenceTrack')}
                              </h4>
                              <p className="text-xs text-ash mt-0.5 font-mono">
                                ID: {match.reference_track_id}
                              </p>
                            </div>
                            <Badge
                              variant={
                                riskVariantMap[match.risk_level] || "default"
                              }
                            >
                              {match.risk_level.charAt(0).toUpperCase() +
                                match.risk_level.slice(1)}
                            </Badge>
                          </div>

                          {/* Score Breakdown */}
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                            {(
                              [
                                { key: "melody_score", label: tMatch('dimensions.melody') },
                                { key: "harmony_score", label: tMatch('dimensions.harmony') },
                                { key: "rhythm_score", label: tMatch('dimensions.rhythm') },
                                { key: "structure_score", label: tMatch('dimensions.structure') },
                                { key: "overall_score", label: tMatch('similarity') },
                              ] as { key: string; label: string }[]
                            ).map(({ key, label }) => {
                              const score = (match as unknown as Record<string, number>)[key] ?? 0;
                              return (
                                <div key={key}>
                                  <span className="text-xs text-ash">
                                    {label}
                                  </span>
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="flex-1 h-1.5 bg-graphite rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-forensic-blue rounded-full transition-all"
                                        style={{
                                          width: `${Math.round(score * 100)}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs font-mono text-bone">
                                      {Math.round(score * 100)}%
                                    </span>
                                  </div>
                                </div>
                                );
                              })}
                            </div>

                          {/* Confidence */}
                          <div className="mt-4 pt-4 border-t border-slate flex items-center gap-2 text-xs text-ash">
                            <span>{tMatch('confidence')}: <span className="text-bone font-mono">{Math.round(match.overall_similarity * 100)}%</span></span>
                          </div>

                          {/* Segment Alignment Evidence */}
                          <div className="mt-4">
                            <MatchEvidenceSection
                              matchId={match.id}
                              titleA={displayAnalysis.file_name}
                              titleB={match.reference_track_id ?? "Reference Track"}
                              durationA={displayAnalysis.duration_seconds ?? 210}
                              durationB={210}
                              audioUrlA={displayAnalysis.audio_url}
                              overallScore={match.score_overall ?? match.overall_similarity ?? 0}
                              defaultExpanded={false}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reproducibility Verification */}
                  {displayAnalysis.status === "completed" && !isDemo && (
                    <ReproductionCard
                      analysisId={displayAnalysis.id}
                      hasAudio={!!displayAnalysis.audio_url}
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function getCompletedSteps(status: string): PipelineStepName[] {
  const stepOrder: PipelineStepName[] = [...PIPELINE_STEPS];
  const statusMap: Record<string, number> = {
    queued: 0,
    normalizing: 1,
    fingerprinting: 2,
    separating_stems: 2,
    extracting_features: 3,
    generating_embeddings: 4,
    searching_matches: 4,
    enriching_rights: 5,
    generating_report: 5,
    completed: 6,
    failed: -1,
  };

  const idx = statusMap[status] ?? 0;
  if (status === "completed") return stepOrder;
  return stepOrder.slice(0, idx);
}

function getCurrentStep(status: string): PipelineStepName | null {
  const statusMap: Record<string, PipelineStepName> = {
    queued: "upload",
    normalizing: "normalize",
    fingerprinting: "separate",
    separating_stems: "separate",
    extracting_features: "extract",
    generating_embeddings: "extract",
    searching_matches: "match",
    enriching_rights: "match",
    generating_report: "classify",
  };
  return statusMap[status] || null;
}
