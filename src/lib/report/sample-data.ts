/**
 * PROBATIO — Sample Data for PDF Template Generation
 *
 * Realistic, consistent data populating all 5 PDF document formats
 * for attorney review. Every value is plausible — the attorney must
 * believe these are real documents to give meaningful feedback.
 */

// ────────────────────────────────────────────────────────────────
// Common Types
// ────────────────────────────────────────────────────────────────

interface SampleEvidence {
  source_time: string;
  target_time: string;
  dimension: string;
  similarity: number;
  transposition: string | null;
  resolution: string;
}

interface SampleDimensionScore {
  raw: number;
  adjusted: number;
  baseline: number;
}

interface SampleCustodyEntry {
  sequence: number;
  action: string;
  hash: string;
  timestamp: string;
}

// ────────────────────────────────────────────────────────────────
// 1. FORENSIC EVIDENCE REPORT — Rivera v. Santos Music Group
// ────────────────────────────────────────────────────────────────

export const SAMPLE_FORENSIC = {
  case_id: "fc-2026-0047",
  case_name: "Rivera v. Santos Music Group",
  created_at: "2026-03-15T14:30:00Z",

  track_a: {
    title: "Amor en la Playa",
    artist: "Carlos Rivera",
    label: "Track A (Plaintiff\u2019s Work)",
    duration_sec: 228,
    file_hash:
      "a7f3b2c8d9e4f1a6b5c0d7e8f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
    language: "Spanish",
    genre: "Reggaeton",
    genre_confidence: 0.91,
    release_date: "2026-02-14",
    isrc: "USRC12600147",
    tempo_bpm: 92,
    key: "C minor",
  },

  track_b: {
    title: "Noches de Verano",
    artist: "Santos Music Group ft. DJ Pablito",
    label: "Track B (Defendant\u2019s Work)",
    duration_sec: 214,
    file_hash:
      "b8c4d3e5f6a7b2c9d0e1f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4",
    language: "Spanish",
    genre: "Reggaeton",
    genre_confidence: 0.88,
    release_date: "2026-03-01",
    isrc: "USRC12600203",
    tempo_bpm: 94,
    key: "D minor",
  },

  scores: {
    melody: { raw: 0.82, adjusted: 0.71, baseline: 0.35 } as SampleDimensionScore,
    harmony: { raw: 0.65, adjusted: 0.38, baseline: 0.55 } as SampleDimensionScore,
    rhythm: { raw: 0.75, adjusted: 0.17, baseline: 0.70 } as SampleDimensionScore,
    timbre: { raw: 0.45, adjusted: 0.30, baseline: 0.30 } as SampleDimensionScore,
    lyrics: { raw: 0.58, adjusted: 0.42, baseline: 0.25 } as SampleDimensionScore,
  },
  overall_raw: 0.68,
  overall_adjusted: 0.43,
  risk_level: "high",

  multi_resolution: {
    melody: { bar: 0.94, phrase: 0.78, song: 0.45 },
    harmony: { bar: 0.65, phrase: 0.58, song: 0.40 },
    rhythm: { bar: 0.78, phrase: 0.75, song: 0.62 },
    timbre: { bar: 0.48, phrase: 0.45, song: 0.38 },
    lyrics: { bar: 0.62, phrase: 0.58, song: 0.50 },
  },

  evidence: [
    { source_time: "0:48-0:52", target_time: "0:32-0:36", dimension: "Melody", similarity: 0.94, transposition: "+2 semitones (up major 2nd)", resolution: "bar" },
    { source_time: "1:04-1:08", target_time: "0:48-0:52", dimension: "Melody", similarity: 0.88, transposition: "+2 semitones (up major 2nd)", resolution: "bar" },
    { source_time: "1:20-1:28", target_time: "0:56-1:04", dimension: "Melody", similarity: 0.86, transposition: "+2 semitones (up major 2nd)", resolution: "phrase" },
    { source_time: "2:12-2:16", target_time: "1:48-1:52", dimension: "Melody", similarity: 0.82, transposition: "+2 semitones (up major 2nd)", resolution: "bar" },
    { source_time: "0:52-0:56", target_time: "0:36-0:40", dimension: "Harmony", similarity: 0.72, transposition: null, resolution: "phrase" },
    { source_time: "1:08-1:16", target_time: "0:52-1:00", dimension: "Harmony", similarity: 0.65, transposition: null, resolution: "phrase" },
    { source_time: "0:08-0:16", target_time: "0:08-0:16", dimension: "Rhythm", similarity: 0.78, transposition: null, resolution: "phrase" },
    { source_time: "0:48-0:56", target_time: "0:32-0:40", dimension: "Lyrics", similarity: 0.65, transposition: null, resolution: "phrase" },
    { source_time: "1:36-1:40", target_time: "1:12-1:16", dimension: "Timbre", similarity: 0.61, transposition: null, resolution: "phrase" },
    { source_time: "0:24-0:28", target_time: "0:16-0:20", dimension: "Melody", similarity: 0.76, transposition: "+2 semitones (up major 2nd)", resolution: "bar" },
  ] as SampleEvidence[],

  custody_chain: [
    { sequence: 1, action: "file_uploaded", hash: "a7f3b2c8d9e4f1a6", timestamp: "2026-03-15T14:30:12Z" },
    { sequence: 2, action: "pipeline_started", hash: "c4d5e6f7a8b9c0d1", timestamp: "2026-03-15T14:30:15Z" },
    { sequence: 3, action: "audio_normalized", hash: "e2f3a4b5c6d7e8f9", timestamp: "2026-03-15T14:30:28Z" },
    { sequence: 4, action: "stems_separated", hash: "a0b1c2d3e4f5a6b7", timestamp: "2026-03-15T14:30:45Z" },
    { sequence: 5, action: "features_extracted", hash: "c8d9e0f1a2b3c4d5", timestamp: "2026-03-15T14:31:02Z" },
    { sequence: 6, action: "genre_detected", hash: "e6f7a8b9c0d1e2f3", timestamp: "2026-03-15T14:31:05Z" },
    { sequence: 7, action: "embeddings_generated", hash: "a4b5c6d7e8f9a0b1", timestamp: "2026-03-15T14:31:18Z" },
    { sequence: 8, action: "lyrics_extracted", hash: "c2d3e4f5a6b7c8d9", timestamp: "2026-03-15T14:31:35Z" },
    { sequence: 9, action: "comparison_completed", hash: "e0f1a2b3c4d5e6f7", timestamp: "2026-03-15T14:31:52Z" },
    { sequence: 10, action: "report_generated", hash: "a8b9c0d1e2f3a4b5", timestamp: "2026-03-15T14:32:05Z" },
    { sequence: 11, action: "expert_annotation_added", hash: "c6d7e8f9a0b1c2d3", timestamp: "2026-03-18T09:15:22Z" },
    { sequence: 12, action: "report_exported", hash: "e4f5a6b7c8d9e0f1", timestamp: "2026-03-20T11:42:18Z" },
  ] as SampleCustodyEntry[],

  pipeline: {
    tag: "v1.2.0",
    demucs: "htdemucs_ft v4.0.1",
    crepe: "full capacity v0.0.16",
    clap: "laion/larger_clap_music_and_speech",
    whisper: "large-v3 (openai-whisper 20240930)",
    embedding: "all-MiniLM-L6-v2 (384\u2192512 padded)",
    dtw: "custom with 12-semitone transposition detection",
    librosa: "0.10.1",
  },

  expert_annotations: [
    {
      author: "Dr. Maria Fernandez, Ph.D. Musicology, Berklee College of Music",
      date: "2026-03-18",
      note:
        "The melodic contour in the chorus (0:48-1:08) exhibits substantial similarity to the reference " +
        "track. The consistent +2 semitone transposition across all matching melodic segments is characteristic " +
        "of deliberate key change to obscure source material. The rhythmic similarity (0.75 raw) is within " +
        "normal range for reggaeton (baseline: 0.70) and is not independently actionable.",
    },
    {
      author: "Dr. Maria Fernandez, Ph.D. Musicology, Berklee College of Music",
      date: "2026-03-18",
      note:
        "Recommend focusing on melodic evidence at bar-level resolution (0.94 similarity at 0:48-0:52). " +
        "This concentrated similarity in the hook section is the strongest evidence of copying. The 14-day " +
        "gap between releases supports access.",
    },
  ],

  narrative: {
    executive_summary:
      "This forensic analysis compares \u201cAmor en la Playa\u201d by Carlos Rivera (Track A) with " +
      "\u201cNoches de Verano\u201d by Santos Music Group (Track B) across five musical dimensions. " +
      "The analysis reveals substantial melodic similarity concentrated in the chorus section " +
      "(0:48-1:08 of Track A corresponding to 0:32-0:52 of Track B), with a genre-adjusted melody " +
      "score of 0.71 exceeding the actionable threshold for reggaeton (0.65). The melodic contour " +
      "in Track B appears to be a transposition of Track A\u2019s chorus melody, shifted up 2 " +
      "semitones (a major second). After controlling for genre-typical rhythmic similarity " +
      "(reggaeton baseline: 0.70), the rhythm dimension does not independently suggest copying. " +
      "The lyrics show moderate similarity (0.42 adjusted) concentrated in the chorus hook phrase. " +
      "Overall risk assessment: HIGH \u2014 legal review recommended.",

    risk_assessment:
      "Based on the concentrated melodic similarity in the chorus section (bars 12-20), combined " +
      "with the consistent +2 semitone transposition across all matching melodic segments, and the " +
      "14-day gap between Track A\u2019s release (February 14, 2026) and Track B\u2019s release " +
      "(March 1, 2026), this case presents characteristics consistent with cases where courts have " +
      "found substantial similarity. The concentrated nature of the match (90%+ of melodic evidence " +
      "in a 20-second section) strengthens the substantial similarity argument, as courts have held " +
      "that copying of a qualitatively significant portion \u2014 even if quantitatively small \u2014 " +
      "can constitute infringement (Newton v. Diamond, 388 F.3d 1189, 9th Cir. 2004).",

    recommendations:
      "1. Retain original composition files, session recordings, and demo recordings for Track B.\n" +
      "2. Obtain legal opinion on the melodic similarity findings before continuing distribution.\n" +
      "3. Consider proactive outreach to rights holders of Track A to explore licensing.\n" +
      "4. If proceeding with distribution, ensure all streaming platforms are notified.",

    limitations:
      "This analysis is based on automated audio comparison and does not constitute legal advice. " +
      "Similarity scores reflect technical resemblance and do not determine copyright infringement, " +
      "which is a legal conclusion that can only be made by a court of law. The reference corpus " +
      "does not represent all copyrighted works globally. Genre-adjusted scores are based on " +
      "statistical baselines and may not capture all genre conventions. The determination of " +
      "\u2018substantial similarity\u2019 is ultimately a legal question for the trier of fact.",

    dimension_explanations: {
      melody:
        "Melody is analyzed by extracting the pitch contour (fundamental frequency over time) from the " +
        "isolated vocals stem using CREPE neural pitch detection. The pitch contour is converted to a " +
        "semitone sequence, and Dynamic Time Warping (DTW) with 12-semitone transposition detection is " +
        "applied to find the optimal alignment. Melody carries the highest weight (30%) because melodic " +
        "similarity is the strongest legal indicator of copying in music copyright case law.",
      harmony:
        "Harmony is analyzed by computing chroma vectors (12-dimensional pitch-class profiles) from the " +
        "bass and accompaniment stems. Chroma vectors are inherently transposition-invariant, representing " +
        "the distribution of pitch classes regardless of octave or key. Cosine similarity between chroma " +
        "vectors measures harmonic resemblance. Weight: 20%.",
      rhythm:
        "Rhythm is analyzed by computing onset strength envelopes and beat positions from the drums stem. " +
        "Onset density (onsets per second), tempo estimation, and beat grid correlation are compared using " +
        "DTW alignment. Rhythm carries lower weight (15%) because rhythmic patterns are genre-defined and " +
        "common drum patterns cannot be monopolized under copyright law.",
      timbre:
        "Timbre is analyzed by generating CLAP (Contrastive Language-Audio Pretraining) embeddings from " +
        "the full audio mix. CLAP produces 512-dimensional vectors capturing the overall sonic character " +
        "of the recording. Cosine similarity between embeddings measures timbral resemblance. Weight: 15%.",
      lyrics:
        "Lyrics are analyzed by transcribing the isolated vocals using Whisper large-v3, then generating " +
        "text embeddings using all-MiniLM-L6-v2 (384 dimensions, padded to 512). Cosine similarity between " +
        "text embeddings measures semantic resemblance in the lyrical content. Weight: 20%.",
    },
  },
};

// ────────────────────────────────────────────────────────────────
// 2. CLEARANCE REPORT
// ────────────────────────────────────────────────────────────────

export const SAMPLE_CLEARANCE = {
  analysisId: "cl-2026-0891",
  track: {
    title: "Luna Nueva",
    artist: "Valentina Cruz",
    duration_sec: 195,
    file_hash: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
    language: "Spanish",
    genre: "Latin Pop",
    genre_confidence: 0.85,
    tempo_bpm: 108,
    key: "G major",
  },
  catalogs: [
    { name: "Rimas Entertainment \u2014 Sonar Music", trackCount: 2847 },
    { name: "Rimas Entertainment \u2014 Nain Music", trackCount: 1203 },
  ],
  totalScanned: 4050,
  verdict: "conditional" as const,
  pipelineVersion: "1.2.0",
  analyzedAt: "March 28, 2026",
  matches: [
    {
      rank: 1,
      title: "Brilla en la Noche",
      artist: "Sofia Reyes",
      isrc: "USRC12501234",
      releaseYear: 2025,
      catalog: "Rimas Entertainment \u2014 Nain Music",
      risk: "moderate",
      scores: {
        melody: { raw: 0.74, adjusted: 0.60 },
        harmony: { raw: 0.65, adjusted: 0.36 },
        rhythm: { raw: 0.52, adjusted: 0.13 },
        timbre: { raw: 0.40, adjusted: 0.18 },
        lyrics: { raw: 0.45, adjusted: 0.22 },
      },
      overall: { raw: 0.59, adjusted: 0.35 },
      finding:
        "Melodic similarity of 60% (genre-adjusted) detected in the verse section (0:24-0:40). " +
        "The melodic phrase uses a similar ascending contour with comparable rhythmic phrasing.",
      recommendation:
        "Review the verse melody (0:24-0:40). Consider modifying the melodic phrase or obtaining clearance from rights holders.",
      evidence: [
        { sourceTime: "0:24-0:28", targetTime: "0:16-0:20", dimension: "Melody", similarity: 0.78, detail: "Same key" },
        { sourceTime: "0:32-0:36", targetTime: "0:24-0:28", dimension: "Melody", similarity: 0.72, detail: "Same key" },
        { sourceTime: "0:28-0:36", targetTime: "0:20-0:28", dimension: "Harmony", similarity: 0.68, detail: "I-vi-IV-V" },
      ],
    },
    {
      rank: 2,
      title: "Estrellas Fugaces",
      artist: "Marco Antonio",
      isrc: "USRC12500891",
      releaseYear: 2024,
      catalog: "Rimas Entertainment \u2014 Sonar Music",
      risk: "low",
      scores: {
        melody: { raw: 0.62, adjusted: 0.42 },
        harmony: { raw: 0.58, adjusted: 0.24 },
        rhythm: { raw: 0.55, adjusted: 0.18 },
        timbre: { raw: 0.35, adjusted: 0.15 },
        lyrics: { raw: 0.30, adjusted: 0.12 },
      },
      overall: { raw: 0.52, adjusted: 0.26 },
      finding: "Moderate similarity within normal range for Latin Pop. Common chord progression shared.",
      recommendation: "No action required. Similarity within normal genre conventions.",
      evidence: [],
    },
  ],
};

// ────────────────────────────────────────────────────────────────
// 3. CLEARANCE CERTIFICATE (Cleared verdict)
// ────────────────────────────────────────────────────────────────

export const SAMPLE_CERTIFICATE = {
  trackTitle: "Cielo Abierto",
  artist: "Diego Morales",
  durationFormatted: "3:22",
  fileHash: "f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2",
  language: "Spanish",
  detectedGenre: "Pop",
  genreConfidence: 0.87,
  analysisDate: "March 31, 2026",
  analysisId: "cl-2026-1204",
  pipelineVersion: "1.2.0",
  catalogs: [
    { name: "Universal Publishing 2024", trackCount: 487 },
    { name: "Latin Urban Catalog", trackCount: 315 },
  ],
  totalTracksScanned: 802,
  highestMatchScore: 0.28,
  clearanceStatus: "cleared" as const,
  chainEntryCount: 10,
};

// ────────────────────────────────────────────────────────────────
// 4. BATCH CLEARANCE (8 tracks — full EP)
// ────────────────────────────────────────────────────────────────

export const SAMPLE_BATCH = {
  batchName: "Valentina Cruz \u2014 \u201cLunas\u201d EP Pre-Release Clearance",
  batchId: "bc-2026-0034",
  analyzedAt: "March 30, 2026",
  pipelineVersion: "1.2.0",
  catalogs: [
    { name: "Rimas Entertainment \u2014 Sonar Music", trackCount: 2847 },
    { name: "Rimas Entertainment \u2014 Nain Music", trackCount: 1203 },
  ],
  totalScanned: 4050,
  overallVerdict: "conditional" as const,
  tracks: [
    { title: "01 \u2014 Intro (Lunas)", verdict: "cleared", score: 0.12, matches: 0 },
    { title: "02 \u2014 Luna Nueva", verdict: "conditional", score: 0.59, matches: 2 },
    { title: "03 \u2014 Cielo Abierto", verdict: "cleared", score: 0.28, matches: 0 },
    { title: "04 \u2014 Bajo las Estrellas", verdict: "cleared", score: 0.18, matches: 0 },
    { title: "05 \u2014 Fuego Lento", verdict: "cleared", score: 0.22, matches: 0 },
    { title: "06 \u2014 Amanecer (feat. Marco Antonio)", verdict: "conditional", score: 0.48, matches: 1 },
    { title: "07 \u2014 Interludio", verdict: "cleared", score: 0.05, matches: 0 },
    { title: "08 \u2014 Lunas (Outro)", verdict: "cleared", score: 0.15, matches: 0 },
  ],
};

// ────────────────────────────────────────────────────────────────
// 5. SCREENING REPORT
// ────────────────────────────────────────────────────────────────

export const SAMPLE_SCREENING = {
  analysisId: "sc-2026-0512",
  fileName: "demo_track_reggaeton_2026.wav",
  fileHash: "c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4",
  durationSec: 210,
  tempoBpm: 95,
  key: "A minor",
  overallRisk: "moderate",
  overallScore: 0.52,
  pipelineVersion: "1.2.0",
  analyzedAt: "March 25, 2026",
  matchCount: 3,
  matches: [
    {
      title: "Noche Caliente",
      artist: "Los Hermanos",
      scoreOverall: 0.52,
      scoreMelody: 0.65,
      scoreHarmony: 0.48,
      scoreRhythm: 0.72,
      scoreTimbre: 0.35,
      riskLevel: "moderate",
      evidence: [
        { sourceTime: "0:32-0:36", targetTime: "0:48-0:52", dimension: "Melody", similarity: 0.71 },
        { sourceTime: "0:08-0:16", targetTime: "0:08-0:16", dimension: "Rhythm", similarity: 0.75 },
      ],
    },
    {
      title: "Fuego en el Beat",
      artist: "DJ Tremendo",
      scoreOverall: 0.38,
      scoreMelody: 0.42,
      scoreHarmony: 0.35,
      scoreRhythm: 0.68,
      scoreTimbre: 0.28,
      riskLevel: "low",
      evidence: [],
    },
  ],
};
