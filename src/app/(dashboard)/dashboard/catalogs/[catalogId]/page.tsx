"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Header } from "@/components/dashboard/header";
import { Button, Badge } from "@/components/ui";
import {
  ArrowLeft,
  Upload,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Search,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { estimateCatalogCost } from "@/lib/catalog/cost-estimate";
import type { EnterpriseCatalogRow } from "@/types/database";

interface TrackRow {
  id: string;
  title: string;
  artist: string;
  isrc: string | null;
  status: string;
  fingerprinted: boolean;
  duration_seconds: number | null;
  created_at: string;
}

const STATUS_ICONS: Record<string, typeof CheckCircle> = {
  completed: CheckCircle,
  failed: XCircle,
  processing: Loader2,
  pending: Clock,
};

const STATUS_COLORS: Record<string, string> = {
  completed: "text-risk-low",
  failed: "text-signal-red",
  processing: "text-forensic-blue",
  pending: "text-ash",
};

export default function CatalogDetailPage() {
  const { catalogId } = useParams() as { catalogId: string };
  const router = useRouter();
  const t = useTranslations("catalogs");
  const tCommon = useTranslations("common");

  const [catalog, setCatalog] = useState<EnterpriseCatalogRow | null>(null);
  const [stats, setStats] = useState<{
    total: number;
    processed: number;
    failed: number;
    pending: number;
    completion_pct: number;
  } | null>(null);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [tracksTotal, setTracksTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [showCostPreview, setShowCostPreview] = useState(false);

  const fetchCatalog = useCallback(async () => {
    const res = await fetch(`/api/catalogs/${catalogId}`);
    if (res.ok) {
      const data = await res.json();
      setCatalog(data);
      setStats(data.stats);
    }
  }, [catalogId]);

  const fetchTracks = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "25",
    });
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (search) params.set("search", search);

    const res = await fetch(
      `/api/catalogs/${catalogId}/tracks?${params.toString()}`,
    );
    if (res.ok) {
      const data = await res.json();
      setTracks(data.tracks);
      setTracksTotal(data.total);
    }
  }, [catalogId, page, statusFilter, search]);

  useEffect(() => {
    Promise.all([fetchCatalog(), fetchTracks()]).finally(() =>
      setLoading(false),
    );
  }, [fetchCatalog, fetchTracks]);

  // Realtime subscription for catalog progress
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`catalog-progress-${catalogId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "enterprise_catalogs",
          filter: `id=eq.${catalogId}`,
        },
        (payload) => {
          setCatalog(payload.new as EnterpriseCatalogRow);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [catalogId]);

  const handleStartIngestion = async () => {
    setIngesting(true);
    try {
      const res = await fetch(`/api/catalogs/${catalogId}/ingest`, {
        method: "POST",
      });
      if (res.ok) {
        setShowCostPreview(false);
        await fetchCatalog();
      }
    } finally {
      setIngesting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header title={t("title")} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-forensic-blue" />
        </div>
      </>
    );
  }

  if (!catalog) {
    return (
      <>
        <Header title={t("title")} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-ash">Catalog not found.</p>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/catalogs")}
          >
            {t("backToCatalogs")}
          </Button>
        </div>
      </>
    );
  }

  const pendingCount = stats?.pending ?? 0;
  const costEstimate = pendingCount > 0 ? estimateCatalogCost(pendingCount) : null;
  const progress = catalog.ingestion_progress as {
    total?: number;
    processed?: number;
    failed?: number;
  } | null;
  const pct =
    progress?.total && progress.total > 0
      ? Math.round(
          ((progress.processed ?? 0) / progress.total) * 100,
        )
      : stats?.completion_pct ?? 0;

  return (
    <>
      <Header title={catalog.name} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
          {/* Back link */}
          <Link
            href="/dashboard/catalogs"
            className="inline-flex items-center gap-1 text-sm text-ash hover:text-bone transition-colors"
          >
            <ArrowLeft size={14} />
            {t("backToCatalogs")}
          </Link>

          {/* Catalog Header */}
          <div className="bg-carbon border border-slate rounded-lg p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-semibold text-bone">
                    {catalog.name}
                  </h2>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      catalog.status === "completed"
                        ? "bg-risk-low/20 text-risk-low"
                        : catalog.status === "ingesting"
                          ? "bg-forensic-blue/20 text-forensic-blue"
                          : "bg-ash/20 text-ash"
                    }`}
                  >
                    {t(`status.${catalog.status}`)}
                  </span>
                </div>
                <p className="text-sm text-ash">
                  {stats?.total ?? 0} tracks · {stats?.processed ?? 0}{" "}
                  processed
                  {(stats?.failed ?? 0) > 0 && (
                    <span className="text-signal-red">
                      {" "}
                      · {stats!.failed} failed
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                {pendingCount > 0 && catalog.status !== "ingesting" && (
                  <Button
                    size="sm"
                    onClick={() => setShowCostPreview(true)}
                  >
                    <Play size={14} />
                    {t("startIngestion")}
                  </Button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {catalog.status === "ingesting" && (
              <div className="mt-4">
                <div className="h-2 bg-graphite rounded-full overflow-hidden">
                  <div
                    className="h-full bg-forensic-blue rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-ash mt-1 block">
                  {pct}% complete
                </span>
              </div>
            )}
          </div>

          {/* Search + Filter */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ash"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder={t("trackList.search")}
                className="w-full pl-9 pr-3 py-2 bg-graphite border border-slate rounded-md text-sm text-bone placeholder:text-ash focus:border-forensic-blue focus:outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              className="px-3 py-2 bg-graphite border border-slate rounded-md text-sm text-bone focus:border-forensic-blue focus:outline-none"
            >
              <option value="all">{t("trackList.filterAll")}</option>
              <option value="completed">{t("trackList.ready")}</option>
              <option value="processing">{t("trackList.processing")}</option>
              <option value="pending">{t("trackList.pending")}</option>
              <option value="failed">{t("trackList.failed")}</option>
            </select>
          </div>

          {/* Track Table */}
          <div className="bg-carbon border border-slate rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate/50 text-xs text-ash">
                    <th className="px-4 py-2.5 text-left font-medium">
                      {t("trackList.title")}
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium">
                      {t("trackList.artist")}
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium">
                      {t("trackList.status")}
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium">
                      {t("trackList.isrc")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tracks.map((track) => {
                    const Icon =
                      STATUS_ICONS[track.status] ?? Clock;
                    const color =
                      STATUS_COLORS[track.status] ?? "text-ash";
                    return (
                      <tr
                        key={track.id}
                        className="border-b border-slate/20 hover:bg-graphite/30"
                      >
                        <td className="px-4 py-2.5 text-bone truncate max-w-[250px]">
                          {track.title}
                        </td>
                        <td className="px-4 py-2.5 text-ash">
                          {track.artist}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center gap-1 ${color}`}
                          >
                            <Icon
                              size={12}
                              className={
                                track.status === "processing"
                                  ? "animate-spin"
                                  : ""
                              }
                            />
                            <span className="text-xs capitalize">
                              {track.status}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-ash font-mono text-xs">
                          {track.isrc ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {tracks.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-ash"
                      >
                        No tracks found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {tracksTotal > 25 && (
              <div className="flex items-center justify-between px-4 py-2 border-t border-slate/50 text-xs text-ash">
                <span>
                  {t("trackList.showing", {
                    from: page * 25 + 1,
                    to: Math.min((page + 1) * 25, tracksTotal),
                    total: tracksTotal,
                  })}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    {tCommon("back")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={(page + 1) * 25 >= tracksTotal}
                  >
                    {tCommon("next")}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Cost Preview Modal */}
          {showCostPreview && costEstimate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="bg-carbon border border-slate rounded-lg p-6 w-full max-w-md mx-4">
                <h3 className="text-lg font-semibold text-bone mb-4">
                  {t("costPreview.title")}
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ash">{t("costPreview.tracks")}</span>
                    <span className="text-bone font-mono">
                      {costEstimate.track_count}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ash">
                      {t("costPreview.estimatedCost")}
                    </span>
                    <span className="text-bone font-mono">
                      ${costEstimate.estimated_cost_usd.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ash">
                      {t("costPreview.estimatedTime")}
                    </span>
                    <span className="text-bone font-mono">
                      ~{costEstimate.estimated_time_minutes} min
                    </span>
                  </div>
                  {costEstimate.is_within_plan && (
                    <p className="text-xs text-risk-low">
                      {t("costPreview.includedInPlan")}
                    </p>
                  )}
                </div>
                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowCostPreview(false)}
                  >
                    {t("costPreview.cancel")}
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleStartIngestion}
                    disabled={ingesting}
                  >
                    {ingesting && (
                      <Loader2 size={14} className="animate-spin" />
                    )}
                    {t("costPreview.confirm")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
