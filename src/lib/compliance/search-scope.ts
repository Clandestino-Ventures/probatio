// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Search Scope Documentation
 *
 * Computes and documents exactly which catalogs were searched
 * for a given analysis. This goes into the chain of custody
 * as proof of data isolation.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export interface SearchScopeEntry {
  type: "public" | "enterprise" | "cross_analysis";
  organizationId?: string;
  organizationName?: string;
  trackCount: number;
  matchesFound: number;
}

export interface SearchScope {
  catalogsSearched: SearchScopeEntry[];
  excluded: string[];
  totalTracksSearched: number;
  totalMatchesFound: number;
  thresholdUsed: number;
}

/**
 * Compute the search scope for an analysis.
 * Returns counts of tracks accessible in each catalog tier.
 */
export async function computeSearchScope(
  userId: string,
  organizationId: string | null,
): Promise<{
  publicTrackCount: number;
  enterpriseTrackCount: number;
  orgName: string | null;
}> {
  const supabase = createAdminClient();

  // Count public tracks with embeddings
  const { count: publicCount } = await supabase
    .from("reference_tracks")
    .select("*", { count: "exact", head: true })
    .eq("visibility", "public")
    .not("embedding", "is", null);

  let enterpriseCount = 0;
  let orgName: string | null = null;

  if (organizationId) {
    const { count } = await supabase
      .from("reference_tracks")
      .select("*", { count: "exact", head: true })
      .eq("visibility", "enterprise")
      .eq("organization_id", organizationId)
      .not("embedding", "is", null);
    enterpriseCount = count ?? 0;

    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .single();
    orgName = org?.name ?? null;
  }

  return {
    publicTrackCount: publicCount ?? 0,
    enterpriseTrackCount: enterpriseCount,
    orgName,
  };
}

/**
 * Build the search scope object for chain of custody logging.
 */
export function buildSearchScope(
  publicTrackCount: number,
  publicMatchCount: number,
  enterpriseTrackCount: number,
  enterpriseMatchCount: number,
  crossAnalysisCount: number,
  crossMatchCount: number,
  threshold: number,
  organizationId?: string | null,
  organizationName?: string | null,
): SearchScope {
  const catalogs: SearchScopeEntry[] = [
    {
      type: "public",
      trackCount: publicTrackCount,
      matchesFound: publicMatchCount,
    },
  ];

  if (organizationId && enterpriseTrackCount > 0) {
    catalogs.push({
      type: "enterprise",
      organizationId,
      organizationName: organizationName ?? undefined,
      trackCount: enterpriseTrackCount,
      matchesFound: enterpriseMatchCount,
    });
  }

  if (crossAnalysisCount > 0) {
    catalogs.push({
      type: "cross_analysis",
      trackCount: crossAnalysisCount,
      matchesFound: crossMatchCount,
    });
  }

  return {
    catalogsSearched: catalogs,
    excluded: [
      "enterprise catalogs of other organizations",
      "forensic case tracks",
      "private tracks of other users",
    ],
    totalTracksSearched: publicTrackCount + enterpriseTrackCount + crossAnalysisCount,
    totalMatchesFound: publicMatchCount + enterpriseMatchCount + crossMatchCount,
    thresholdUsed: threshold,
  };
}
