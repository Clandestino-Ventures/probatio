"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { Button, Badge } from "@/components/ui";
import { Plus, Database, ChevronRight, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import type { EnterpriseCatalogRow } from "@/types/database";

type CatalogWithStats = EnterpriseCatalogRow;

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-ash/20 text-ash",
  ingesting: "bg-forensic-blue/20 text-forensic-blue",
  completed: "bg-risk-low/20 text-risk-low",
  failed: "bg-signal-red/20 text-signal-red",
};

export default function CatalogsPage() {
  const t = useTranslations("catalogs");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [catalogs, setCatalogs] = useState<CatalogWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [planError, setPlanError] = useState(false);

  const fetchCatalogs = useCallback(async () => {
    try {
      const res = await fetch("/api/catalogs");
      const data = await res.json();
      if (res.status === 403) {
        setPlanError(true);
        return;
      }
      setCatalogs(data.catalogs ?? []);
    } catch {
      // fetch failed
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalogs();
  }, [fetchCatalogs]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/catalogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
      });
      if (res.status === 403) {
        setPlanError(true);
        return;
      }
      if (res.ok) {
        setShowCreateDialog(false);
        setNewName("");
        setNewDesc("");
        await fetchCatalogs();
      }
    } finally {
      setCreating(false);
    }
  };

  if (planError) {
    return (
      <>
        <Header title={t("title")} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <Lock size={48} className="text-ash" />
          <p className="text-ash text-center">{t("planRequired")}</p>
          <Button onClick={() => router.push("/dashboard/settings")}>
            {t("upgrade")}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title={t("title")} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
          {/* Header + Create Button */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-ash">{t("subtitle")}</p>
            <Button onClick={() => setShowCreateDialog(true)} size="sm">
              <Plus size={14} />
              {t("newCatalog")}
            </Button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex justify-center py-16">
              <Loader2 size={24} className="animate-spin text-forensic-blue" />
            </div>
          )}

          {/* Empty State */}
          {!loading && catalogs.length === 0 && (
            <div className="text-center py-16 bg-carbon border border-slate rounded-lg">
              <Database size={40} className="mx-auto text-ash mb-3" />
              <p className="text-ash">{t("empty")}</p>
            </div>
          )}

          {/* Catalog Cards */}
          {catalogs.map((catalog) => {
            const progress = catalog.ingestion_progress as {
              total?: number;
              processed?: number;
              failed?: number;
            } | null;
            const total = progress?.total ?? catalog.track_count ?? 0;
            const processed = progress?.processed ?? catalog.tracks_with_embeddings ?? 0;
            const failed = progress?.failed ?? 0;
            const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

            return (
              <Link
                key={catalog.id}
                href={`/dashboard/catalogs/${catalog.id}`}
                className="block bg-carbon border border-slate rounded-lg p-5 hover:border-forensic-blue/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-bone truncate">
                        {catalog.name}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[catalog.status] ?? STATUS_COLORS.pending}`}
                      >
                        {t(`status.${catalog.status}`)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-ash mt-1">
                      <span>
                        {processed} / {total} {t("stats.processed", { count: "" }).replace(/ $/, "")}
                      </span>
                      {failed > 0 && (
                        <span className="text-signal-red">
                          {failed} {t("trackList.failed").toLowerCase()}
                        </span>
                      )}
                      {catalog.actual_cost_cents != null && (
                        <span>
                          {t("stats.cost", {
                            amount: (catalog.actual_cost_cents / 100).toFixed(2),
                          })}
                        </span>
                      )}
                    </div>

                    {/* Progress bar for ingesting catalogs */}
                    {catalog.status === "ingesting" && total > 0 && (
                      <div className="mt-3">
                        <div className="h-1.5 bg-graphite rounded-full overflow-hidden">
                          <div
                            className="h-full bg-forensic-blue rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-ash mt-1 block">
                          {pct}% — {processed} of {total}
                        </span>
                      </div>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-ash shrink-0 mt-1" />
                </div>
              </Link>
            );
          })}

          {/* Create Catalog Dialog */}
          {showCreateDialog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="bg-carbon border border-slate rounded-lg p-6 w-full max-w-md mx-4">
                <h3 className="text-lg font-semibold text-bone mb-4">
                  {t("createDialog.title")}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-ash block mb-1">
                      {t("createDialog.name")}
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder={t("createDialog.namePlaceholder")}
                      className="w-full px-3 py-2 bg-graphite border border-slate rounded-md text-sm text-bone placeholder:text-ash focus:border-forensic-blue focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-xs text-ash block mb-1">
                      {t("createDialog.description")}
                    </label>
                    <input
                      type="text"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder={t("createDialog.descriptionPlaceholder")}
                      className="w-full px-3 py-2 bg-graphite border border-slate rounded-md text-sm text-bone placeholder:text-ash focus:border-forensic-blue focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowCreateDialog(false)}
                    >
                      {tCommon("cancel")}
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleCreate}
                      disabled={creating || !newName.trim()}
                    >
                      {creating && <Loader2 size={14} className="animate-spin" />}
                      {t("createDialog.create")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
