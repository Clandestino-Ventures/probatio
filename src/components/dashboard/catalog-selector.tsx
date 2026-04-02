"use client";

/**
 * PROBATIO — Catalog Selector
 *
 * Allows users to select which catalogs to scan against
 * during pre-release clearance. Fetches available catalogs
 * from /api/catalogs.
 */

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, Database, Globe, Loader2 } from "lucide-react";

interface Catalog {
  id: string;
  name: string;
  description: string | null;
  track_count: number;
  tracks_with_embeddings: number;
}

interface PlatformLibrary {
  available: boolean;
  trackCount: number;
  label: string;
}

interface CatalogSelectorProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  includePlatformLibrary: boolean;
  onPlatformLibraryChange: (include: boolean) => void;
  className?: string;
}

export function CatalogSelector({
  selectedIds,
  onSelectionChange,
  includePlatformLibrary,
  onPlatformLibraryChange,
  className,
}: CatalogSelectorProps) {
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [platformLibrary, setPlatformLibrary] = useState<PlatformLibrary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCatalogs() {
      try {
        const res = await fetch("/api/catalogs");
        if (!res.ok) throw new Error("Failed to fetch catalogs");
        const data = await res.json();
        setCatalogs(data.catalogs ?? []);
        setPlatformLibrary(data.platformLibrary ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load catalogs");
      } finally {
        setLoading(false);
      }
    }
    fetchCatalogs();
  }, []);

  function toggleCatalog(id: string) {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((x) => x !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  }

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <Loader2 size={20} className="animate-spin text-ash" />
        <span className="text-sm text-ash ml-2">Loading catalogs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("p-4 rounded-md border border-signal-red/30 bg-signal-red/5", className)}>
        <p className="text-xs text-signal-red">{error}</p>
      </div>
    );
  }

  const hasNoCatalogs = catalogs.length === 0;

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-xs font-mono uppercase tracking-wider text-ash/60">
        Select catalogs to scan against
      </p>

      {/* Platform-wide reference library */}
      {platformLibrary?.available && (
        <button
          type="button"
          onClick={() => onPlatformLibraryChange(!includePlatformLibrary)}
          className={cn(
            "w-full flex items-center gap-3 p-3 rounded-md border transition-all duration-200 text-left",
            includePlatformLibrary
              ? "border-forensic-blue bg-forensic-blue/5"
              : "border-slate hover:border-ash bg-carbon/50"
          )}
        >
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
              includePlatformLibrary ? "bg-forensic-blue/15" : "bg-graphite"
            )}
          >
            {includePlatformLibrary ? (
              <Check size={14} className="text-forensic-blue" />
            ) : (
              <Globe size={14} className="text-ash" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-bone">
              {platformLibrary.label}
            </p>
            <p className="text-xs text-ash">
              {platformLibrary.trackCount.toLocaleString()} tracks with embeddings
            </p>
          </div>
        </button>
      )}

      {/* Organization catalogs */}
      {catalogs.map((catalog) => (
        <button
          key={catalog.id}
          type="button"
          onClick={() => toggleCatalog(catalog.id)}
          className={cn(
            "w-full flex items-center gap-3 p-3 rounded-md border transition-all duration-200 text-left",
            selectedIds.includes(catalog.id)
              ? "border-evidence-gold bg-evidence-gold/5"
              : "border-slate hover:border-ash bg-carbon/50"
          )}
        >
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
              selectedIds.includes(catalog.id)
                ? "bg-evidence-gold/15"
                : "bg-graphite"
            )}
          >
            {selectedIds.includes(catalog.id) ? (
              <Check size={14} className="text-evidence-gold" />
            ) : (
              <Database size={14} className="text-ash" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-bone">{catalog.name}</p>
            <p className="text-xs text-ash">
              {catalog.tracks_with_embeddings.toLocaleString()} of{" "}
              {catalog.track_count.toLocaleString()} tracks indexed
            </p>
          </div>
        </button>
      ))}

      {hasNoCatalogs && !platformLibrary?.available && (
        <div className="p-4 rounded-md border border-slate bg-carbon/50 text-center">
          <p className="text-sm text-ash">No catalogs available.</p>
          <p className="text-xs text-ash/60 mt-1">
            Create a catalog and add reference tracks to enable clearance scanning.
          </p>
        </div>
      )}

      {/* Selection summary */}
      {(selectedIds.length > 0 || includePlatformLibrary) && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-ash">
            Scanning against:{" "}
            <span className="text-bone font-medium">
              {[
                ...(includePlatformLibrary ? ["Platform Library"] : []),
                ...catalogs
                  .filter((c) => selectedIds.includes(c.id))
                  .map((c) => c.name),
              ].join(", ")}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
