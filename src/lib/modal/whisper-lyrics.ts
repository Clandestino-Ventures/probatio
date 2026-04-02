/**
 * PROBATIO — Whisper Lyrics Extraction Wrapper
 *
 * Transcribes isolated vocals using Whisper large-v3 on Modal GPU
 * and generates a 512-dim text embedding for pgvector similarity search.
 */

import { callModalEndpoint } from "./client";
import { MODAL_ENDPOINTS } from "./endpoints";
import { isMockMode } from "./mock";
import type {
  ExtractLyricsRequest,
  ExtractLyricsResponse,
} from "./endpoints";

export type { ExtractLyricsRequest, ExtractLyricsResponse };
export type { WordTimestamp, WhisperSegment } from "./endpoints";

export interface ExtractLyricsParams {
  vocalsUrl: string;
  analysisId: string;
  languageHint: string | null;
}

export async function extractLyrics(
  params: ExtractLyricsParams,
): Promise<ExtractLyricsResponse> {
  if (isMockMode()) {
    return mockExtractLyrics(params);
  }

  return callModalEndpoint<ExtractLyricsRequest, ExtractLyricsResponse>(
    MODAL_ENDPOINTS.extractLyrics,
    {
      vocals_url: params.vocalsUrl,
      analysis_id: params.analysisId,
      language_hint: params.languageHint,
    },
    { timeoutMs: 360_000 },
  );
}

function mockExtractLyrics(params: ExtractLyricsParams): ExtractLyricsResponse {
  const fakeHash = (seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(16).padStart(64, "a").slice(0, 64);
  };

  // Realistic Spanish reggaeton lyrics (3 verses + chorus)
  const mockLyrics = [
    "Ella baila sola bajo la luna llena",
    "con el ritmo que le corre por las venas",
    "no necesita a nadie que le diga qué hacer",
    "porque ella sabe bien lo que es querer",
    "",
    "Dale fuego, dale fuego a la noche",
    "que el amanecer nos encuentre sin reproche",
    "dale fuego, dale fuego al corazón",
    "que esta vida es una sola canción",
    "",
    "Me dice que se va pero siempre vuelve",
    "como la marea que nunca se detiene",
    "sus ojos son un mar donde me pierdo",
    "y en sus labios encuentro lo que quiero",
    "",
    "Dale fuego, dale fuego a la noche",
    "que el amanecer nos encuentre sin reproche",
    "dale fuego, dale fuego al corazón",
    "que esta vida es una sola canción",
    "",
    "Y cuando la música suena más fuerte",
    "se olvida del mundo y de la suerte",
    "solo quiere bailar hasta que el sol salga",
    "y que la noche nunca se le acaba",
  ].join("\n");

  // Realistic word timestamps for first few words
  const wordTimestamps = [
    { word: "Ella", start: 0.5, end: 0.82 },
    { word: "baila", start: 0.84, end: 1.22 },
    { word: "sola", start: 1.25, end: 1.68 },
    { word: "bajo", start: 1.72, end: 2.05 },
    { word: "la", start: 2.08, end: 2.18 },
    { word: "luna", start: 2.2, end: 2.58 },
    { word: "llena", start: 2.6, end: 3.1 },
    { word: "con", start: 3.8, end: 3.98 },
    { word: "el", start: 4.0, end: 4.1 },
    { word: "ritmo", start: 4.12, end: 4.55 },
    { word: "que", start: 4.58, end: 4.7 },
    { word: "le", start: 4.72, end: 4.82 },
    { word: "corre", start: 4.85, end: 5.22 },
    { word: "por", start: 5.25, end: 5.42 },
    { word: "las", start: 5.45, end: 5.58 },
    { word: "venas", start: 5.6, end: 6.12 },
    { word: "no", start: 6.8, end: 6.95 },
    { word: "necesita", start: 6.98, end: 7.65 },
    { word: "a", start: 7.68, end: 7.75 },
    { word: "nadie", start: 7.78, end: 8.22 },
    { word: "que", start: 8.25, end: 8.38 },
    { word: "le", start: 8.4, end: 8.5 },
    { word: "diga", start: 8.52, end: 8.92 },
    { word: "qué", start: 8.95, end: 9.1 },
    { word: "hacer", start: 9.12, end: 9.62 },
  ];

  const segments = [
    { text: "Ella baila sola bajo la luna llena", start: 0.5, end: 3.1 },
    { text: "con el ritmo que le corre por las venas", start: 3.8, end: 6.12 },
    { text: "no necesita a nadie que le diga qué hacer", start: 6.8, end: 9.62 },
    { text: "porque ella sabe bien lo que es querer", start: 10.2, end: 13.5 },
    { text: "Dale fuego, dale fuego a la noche", start: 16.0, end: 19.8 },
    { text: "que el amanecer nos encuentre sin reproche", start: 20.0, end: 24.2 },
    { text: "dale fuego, dale fuego al corazón", start: 24.5, end: 28.1 },
    { text: "que esta vida es una sola canción", start: 28.5, end: 32.0 },
  ];

  // Generate fake 512-dim embedding (unit vector with zero padding after 384)
  const raw384 = Array.from({ length: 384 }, () => Math.random() - 0.5);
  const norm = Math.sqrt(raw384.reduce((sum, v) => sum + v * v, 0));
  const normalized = raw384.map((v) => v / norm);
  const padded512 = [...normalized, ...Array.from({ length: 128 }, () => 0)];

  return {
    lyrics_text: mockLyrics,
    lyrics_language: "es",
    lyrics_embedding: padded512,
    word_timestamps: wordTimestamps,
    segments,
    whisper_model: "large-v3",
    embedding_model: "all-MiniLM-L6-v2",
    output_hash: fakeHash(params.analysisId + "lyrics"),
    processing_time_ms: 8500,
  };
}
