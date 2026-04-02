/**
 * PROBATIO — MusicBrainz API Client
 *
 * Looks up recording metadata, composers, publishers, and rights holders.
 * Used by Step 8 (Rights Enrichment) of the analysis pipeline.
 *
 * Rate limit: 1 request per second (MusicBrainz requirement).
 * User-Agent: required by MusicBrainz API ToS.
 */

const MB_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "Probatio/1.0.0 (support@probatio.audio)";

// Rate limiter
let lastRequestTime = 0;
async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 1100) {
    await new Promise(r => setTimeout(r, 1100 - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
}

export interface RightsInfo {
  composers: Array<{ name: string; role: string }>;
  publishers: Array<{ name: string; pro?: string }>;
  isrcs: string[];
  releases: Array<{ title: string; date: string; label?: string }>;
  musicbrainzUrl: string;
}

export async function lookupRecording(mbid: string): Promise<Record<string, unknown> | null> {
  const url = `${MB_BASE}/recording/${mbid}?inc=artists+releases+isrcs+artist-credits&fmt=json`;
  const res = await rateLimitedFetch(url);
  if (!res.ok) return null;
  return res.json();
}

export async function lookupByISRC(isrc: string): Promise<Record<string, unknown>[]> {
  const url = `${MB_BASE}/isrc/${isrc}?inc=artists+releases&fmt=json`;
  const res = await rateLimitedFetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.recordings ?? [];
}

export async function getRightsInfo(mbid: string): Promise<RightsInfo | null> {
  const recording = await lookupRecording(mbid);
  if (!recording) return null;

  const artists = (recording["artist-credit"] as Array<Record<string, unknown>>) ?? [];
  const releases = (recording.releases as Array<Record<string, unknown>>) ?? [];
  const isrcs = (recording.isrcs as string[]) ?? [];

  // Extract composers from artist credits
  const composers = artists.map((ac: Record<string, unknown>) => {
    const artist = ac.artist as Record<string, unknown>;
    return {
      name: (artist?.name as string) ?? "Unknown",
      role: (ac.type as string) ?? "performer",
    };
  });

  // Extract publishers from release labels
  const publishers: Array<{ name: string; pro?: string }> = [];
  for (const rel of releases) {
    const labelInfo = (rel["label-info"] as Array<Record<string, unknown>>) ?? [];
    for (const li of labelInfo) {
      const label = li.label as Record<string, unknown>;
      if (label?.name) {
        publishers.push({ name: label.name as string });
      }
    }
  }

  const releaseList = releases.slice(0, 5).map((r: Record<string, unknown>) => ({
    title: (r.title as string) ?? "",
    date: (r.date as string) ?? "",
    label: ((r["label-info"] as Array<Record<string, unknown>>)?.[0]?.label as Record<string, unknown>)?.name as string ?? undefined,
  }));

  return {
    composers,
    publishers,
    isrcs,
    releases: releaseList,
    musicbrainzUrl: `https://musicbrainz.org/recording/${mbid}`,
  };
}

/**
 * Enrich a match with rights holder information from MusicBrainz.
 * Looks up by musicbrainz_id first, then ISRC as fallback.
 */
export async function enrichMatchRights(
  musicbrainzId: string | null,
  isrc: string | null,
): Promise<RightsInfo | null> {
  if (musicbrainzId) {
    return getRightsInfo(musicbrainzId);
  }
  if (isrc) {
    const recordings = await lookupByISRC(isrc);
    if (recordings.length > 0) {
      const id = (recordings[0] as Record<string, unknown>).id as string;
      if (id) return getRightsInfo(id);
    }
  }
  return null;
}
