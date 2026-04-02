// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — MusicBrainz Reference Library Seed
 *
 * Populates reference_tracks with metadata from MusicBrainz API.
 * These tracks won't have embeddings (no audio), but they'll match
 * in AcoustID lookups and provide rights/publisher metadata.
 *
 * Rate limit: MusicBrainz API allows 1 request per second.
 */

const MB_BASE_URL = "https://musicbrainz.org/ws/2";
const MB_USER_AGENT = "ProbatioForensicAudio/1.0 (support@probatio.audio)";

interface MBRecording {
  id: string;
  title: string;
  length: number | null;
  "artist-credit": Array<{
    artist: { id: string; name: string };
  }>;
  releases?: Array<{
    id: string;
    title: string;
    date?: string;
  }>;
  isrcs?: string[];
}

/**
 * Search MusicBrainz for recordings matching a query.
 * Returns the raw recording objects.
 */
async function searchRecordings(
  query: string,
  limit: number = 25,
  offset: number = 0
): Promise<MBRecording[]> {
  const url = new URL(`${MB_BASE_URL}/recording`);
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("fmt", "json");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": MB_USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`MusicBrainz API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.recordings ?? [];
}

/**
 * Seed reference_tracks from MusicBrainz search results.
 * Only inserts metadata — no audio, no embeddings.
 */
export async function seedFromMusicBrainz(
  query: string,
  limit: number = 25
): Promise<number> {
  // Dynamic import to avoid importing admin client at module level
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  const recordings = await searchRecordings(query, limit);
  let inserted = 0;

  for (const rec of recordings) {
    const artist = rec["artist-credit"]?.[0]?.artist?.name ?? "Unknown";
    const isrc = rec.isrcs?.[0] ?? null;
    const release = rec.releases?.[0];
    const durationSec = rec.length ? rec.length / 1000 : null;

    // Skip if already exists
    const { data: existing } = await supabase
      .from("reference_tracks")
      .select("id")
      .eq("musicbrainz_id", rec.id)
      .limit(1)
      .single();

    if (existing) continue;

    const { error } = await supabase.from("reference_tracks").insert({
      title: rec.title,
      artist,
      album: release?.title ?? null,
      isrc,
      musicbrainz_id: rec.id,
      duration_sec: durationSec,
      release_date: release?.date ?? null,
      source: "musicbrainz",
      fingerprinted: false,
    });

    if (!error) inserted++;

    // Rate limit: 1 req/sec for MusicBrainz
    await new Promise((r) => setTimeout(r, 1100));
  }

  return inserted;
}

/**
 * Seed with popular tracks across genres commonly involved in copyright disputes.
 */
export async function seedPopularTracks(): Promise<number> {
  const queries = [
    "reggaeton 2024",
    "hip hop 2024",
    "pop hits 2024",
    "latin pop 2024",
    "r&b 2024",
    "trap latino 2024",
    "reggaeton 2023",
    "pop hits 2023",
    "hip hop 2023",
    "afrobeats 2024",
  ];

  let total = 0;
  for (const query of queries) {
    try {
      const count = await seedFromMusicBrainz(query, 50);
      total += count;
      console.log(`[PROBATIO] Seeded ${count} tracks for "${query}"`);
    } catch (err) {
      console.error(`[PROBATIO] Failed to seed "${query}":`, err);
    }
  }

  console.log(`[PROBATIO] Total reference tracks seeded: ${total}`);
  return total;
}
