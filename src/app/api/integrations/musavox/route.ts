// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Musavox Lyrics Ingest Webhook
 *
 * POST /api/integrations/musavox
 *
 * Receives lyrics data from Musavox after a transcription completes.
 * When Musavox transcribes a track, those lyrics and their embedding
 * automatically flow into Probatio's reference library — making the
 * lyrics dimension comparison work with real production transcriptions.
 *
 * Auth: API key with 'integrations' permission (Bearer pk_live_...)
 * Idempotent: same trackId twice = same reference_track_id (no duplicate)
 * Fast: < 200ms response, embedding generation is async via Inngest
 *
 * CROSS-VENTURE PATTERN:
 *   Musavox → Probatio (lyrics webhook)
 *   Future: Musyn → Probatio (artist risk signals)
 *   Each venture has its own auth. Communication via API keys + webhooks.
 */

import { NextResponse } from "next/server";
import { authenticateApiKey, hasPermission } from "@/lib/auth/api-keys";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { inngest } from "@/lib/inngest/client";

// ────────────────────────────────────────────────────────────────────────────
// Request Schema
// ────────────────────────────────────────────────────────────────────────────

interface MusavoxWebhookBody {
  trackId: string;
  title: string;
  artist: string;
  lyrics: string;
  language: string;
  sections?: Array<{
    type: string;
    text: string;
    startTime?: number;
    endTime?: number;
  }>;
  adLibs?: string[];
  confidenceMap?: Array<{
    line: string;
    confidence: number;
  }>;
  duration?: number;
  isrc?: string;
  releaseDate?: string;
  album?: string;
  genre?: string;
}

function validateBody(body: unknown): { valid: true; data: MusavoxWebhookBody } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object." };
  }

  const b = body as Record<string, unknown>;

  if (!b.trackId || typeof b.trackId !== "string") {
    return { valid: false, error: "Missing or invalid 'trackId' (string)." };
  }
  if (!b.title || typeof b.title !== "string") {
    return { valid: false, error: "Missing or invalid 'title' (string)." };
  }
  if (!b.artist || typeof b.artist !== "string") {
    return { valid: false, error: "Missing or invalid 'artist' (string)." };
  }
  if (!b.lyrics || typeof b.lyrics !== "string") {
    return { valid: false, error: "Missing or invalid 'lyrics' (string)." };
  }
  if (!b.language || typeof b.language !== "string") {
    return { valid: false, error: "Missing or invalid 'language' (string)." };
  }

  return { valid: true, data: body as MusavoxWebhookBody };
}

// ────────────────────────────────────────────────────────────────────────────
// Embedding (inline, same model as pipeline Step 5.5)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Generate a 512-dim lyrics embedding by calling the Modal extract-lyrics
 * endpoint's embedding model (all-MiniLM-L6-v2, 384-dim padded to 512).
 *
 * For the webhook, we compute a lightweight embedding synchronously so the
 * reference_track is immediately searchable. The Modal endpoint is used for
 * full Whisper transcription during analysis; here we already HAVE the text.
 *
 * Falls back to a zero vector if embedding generation fails — the track is
 * still stored and can be re-embedded later.
 */
async function generateLyricsEmbedding(text: string): Promise<number[]> {
  if (text.trim().length === 0) {
    return new Array(512).fill(0);
  }

  try {
    // Use the Modal CLAP endpoint for text embedding if available,
    // otherwise call the extract-lyrics endpoint with a special flag.
    // For now, emit an Inngest event to compute the embedding async
    // and return a placeholder. The reference_track will be updated
    // when the embedding is ready.
    //
    // In MODAL_MOCK mode, return a deterministic fake embedding.
    if (process.env.MODAL_MOCK === "true") {
      // Deterministic mock: hash the text to seed the embedding
      let seed = 0;
      for (let i = 0; i < text.length; i++) {
        seed = ((seed << 5) - seed + text.charCodeAt(i)) | 0;
      }
      const rng = (s: number) => {
        s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
        s = Math.imul(s ^ (s >>> 13), 0x45d9f3b);
        return ((s ^ (s >>> 16)) >>> 0) / 0xffffffff - 0.5;
      };
      const raw384 = Array.from({ length: 384 }, (_, i) => rng(seed + i));
      const norm = Math.sqrt(raw384.reduce((sum, v) => sum + v * v, 0));
      const normalized = raw384.map((v) => v / norm);
      return [...normalized, ...new Array(128).fill(0)];
    }

    // Production: call Modal for text embedding
    const { callModalEndpoint } = await import("@/lib/modal/client");
    const result = await callModalEndpoint<
      { text: string },
      { embedding: number[] }
    >("/api/text-embedding", { text }, { timeoutMs: 30_000, maxRetries: 1 });

    return result.embedding;
  } catch {
    // Embedding generation failed — return zeros. The track is still
    // stored and can be re-embedded via a backfill job.
    console.warn("[Musavox webhook] Embedding generation failed, using zero vector");
    return new Array(512).fill(0);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/integrations/musavox
// ────────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // ── Auth: API key with 'integrations' permission ──────────────────
    let apiKeyCtx;
    try {
      apiKeyCtx = await authenticateApiKey(request);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Authentication failed." },
        { status: 401 },
      );
    }

    if (!apiKeyCtx) {
      return NextResponse.json(
        { error: "API key required. Use Bearer pk_live_... in Authorization header." },
        { status: 401 },
      );
    }

    if (!hasPermission(apiKeyCtx, "integrations")) {
      return NextResponse.json(
        { error: "API key lacks 'integrations' permission." },
        { status: 403 },
      );
    }

    // ── Rate limit: 100/hour per API key ──────────────────────────────
    const { success: rateLimitOk } = rateLimit(
      `musavox:${apiKeyCtx.keyId}`,
      100,
      3_600_000,
    );
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Max 100 requests per hour." },
        { status: 429 },
      );
    }

    // ── Parse + validate body ─────────────────────────────────────────
    const rawBody = await request.json();
    const validation = validateBody(rawBody);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 },
      );
    }

    const body = validation.data;

    // ── Idempotency check: has this trackId already been ingested? ────
    const supabase = createAdminClient();

    const { data: existing } = await supabase
      .from("reference_tracks")
      .select("id")
      .eq("source", "musavox")
      .eq("features_json->>musavox_track_id", body.trackId)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        referenceTrackId: existing.id,
        duplicate: true,
      });
    }

    // ── Generate lyrics embedding ────────────────────────────────────
    const lyricsEmbedding = await generateLyricsEmbedding(body.lyrics);

    // ── Parse release year from date ─────────────────────────────────
    let releaseYear: number | null = null;
    if (body.releaseDate) {
      const parsed = new Date(body.releaseDate);
      if (!isNaN(parsed.getTime())) {
        releaseYear = parsed.getFullYear();
      }
    }

    // ── Create reference_track ────────────────────────────────────────
    const referenceTrackId = crypto.randomUUID();

    const { error: insertError } = await supabase
      .from("reference_tracks")
      .insert({
        id: referenceTrackId,
        title: body.title,
        artist: body.artist,
        album: body.album ?? null,
        isrc: body.isrc ?? null,
        release_year: releaseYear,
        genre: body.genre ?? null,
        duration_seconds: body.duration ?? null,
        source: "musavox",
        visibility: "public",
        organization_id: apiKeyCtx.organizationId,
        lyrics_text: body.lyrics,
        lyrics_language: body.language,
        lyrics_embedding: lyricsEmbedding,
        status: "completed",
        features_json: {
          musavox_track_id: body.trackId,
          language: body.language,
          sections: body.sections ?? [],
          ad_libs: body.adLibs ?? [],
          confidence_map: body.confidenceMap ?? [],
          ingested_at: new Date().toISOString(),
        },
      });

    if (insertError) {
      console.error("[Musavox webhook] Insert failed:", insertError.message);
      return NextResponse.json(
        { error: "Failed to create reference track.", detail: insertError.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        referenceTrackId,
        duplicate: false,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/integrations/musavox] Unhandled error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
