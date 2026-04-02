/**
 * PROBATIO — Demo Seed Data
 *
 * Realistic mock data that populates the dashboard for demo/development purposes.
 * Activated when NEXT_PUBLIC_DEMO_MODE=true in the environment.
 */

import type { RiskLevel, AnalysisMatchRow } from '@/types/database';
import type { AnalysisListItem } from '@/types/api';

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const DEMO_ANALYSES: AnalysisListItem[] = [
  {
    id: 'demo-001',
    title: 'Mi_Gente_Remix_Master.wav',
    mode: 'screening',
    status: 'completed',
    overallRisk: 'high',
    matchCount: 3,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-002',
    title: 'Summer_Beat_Final.mp3',
    mode: 'screening',
    status: 'completed',
    overallRisk: 'low',
    matchCount: 1,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-003',
    title: 'Noche_de_Verano_v3.wav',
    mode: 'screening',
    status: 'completed',
    overallRisk: 'critical',
    matchCount: 2,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 156000).toISOString(),
  },
  {
    id: 'demo-004',
    title: 'Untitled_Beat_042.flac',
    mode: 'screening',
    status: 'extracting',
    overallRisk: null,
    matchCount: 0,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    completedAt: null,
  },
  {
    id: 'demo-005',
    title: 'Reggaeton_Sample_Pack_01.wav',
    mode: 'screening',
    status: 'completed',
    overallRisk: 'moderate' as RiskLevel,
    matchCount: 4,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 189000).toISOString(),
  },
];

// Demo match data for demo-001 analysis detail
export const DEMO_MATCHES: AnalysisMatchRow[] = [
  {
    id: 'match-001',
    analysis_id: 'demo-001',
    reference_track_id: 'ref-001',
    compared_analysis_id: null,
    similarity_score: { melody: 0.82, harmony: 0.71, rhythm: 0.68, timbre: 0.55 },
    overall_similarity: 0.89,
    score_melody: 0.82,
    score_harmony: 0.71,
    score_rhythm: 0.68,
    score_timbre: 0.55,
    score_lyrics: null,
    score_melody_adjusted: null,
    score_harmony_adjusted: null,
    score_rhythm_adjusted: null,
    score_timbre_adjusted: null,
    score_lyrics_adjusted: null,
    score_overall_adjusted: null,
    detected_genre: null,
    genre_confidence: null,
    score_overall: 0.76,
    risk_level: 'high' as RiskLevel,
    timestamps_similarity: [
      { queryStart: 12.5, queryEnd: 28.3, referenceStart: 0.0, referenceEnd: 15.8 },
    ],
    rights_info: null,
    action_recommended: 'Obtain clearance before release',
    match_source: 'embedding',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'match-002',
    analysis_id: 'demo-001',
    reference_track_id: 'ref-002',
    compared_analysis_id: null,
    similarity_score: { melody: 0.45, harmony: 0.62, rhythm: 0.71, timbre: 0.33 },
    overall_similarity: 0.74,
    score_melody: 0.45,
    score_harmony: 0.62,
    score_rhythm: 0.71,
    score_timbre: 0.33,
    score_lyrics: null,
    score_melody_adjusted: null,
    score_harmony_adjusted: null,
    score_rhythm_adjusted: null,
    score_timbre_adjusted: null,
    score_lyrics_adjusted: null,
    score_overall_adjusted: null,
    detected_genre: null,
    genre_confidence: null,
    score_overall: 0.52,
    risk_level: 'moderate' as RiskLevel,
    timestamps_similarity: [
      { queryStart: 45.0, queryEnd: 58.2, referenceStart: 30.0, referenceEnd: 43.2 },
    ],
    rights_info: null,
    action_recommended: 'Legal review recommended',
    match_source: 'embedding',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'match-003',
    analysis_id: 'demo-001',
    reference_track_id: 'ref-003',
    compared_analysis_id: null,
    similarity_score: { melody: 0.31, harmony: 0.28, rhythm: 0.55, timbre: 0.22 },
    overall_similarity: 0.61,
    score_melody: 0.31,
    score_harmony: 0.28,
    score_rhythm: 0.55,
    score_timbre: 0.22,
    score_lyrics: null,
    score_melody_adjusted: null,
    score_harmony_adjusted: null,
    score_rhythm_adjusted: null,
    score_timbre_adjusted: null,
    score_lyrics_adjusted: null,
    score_overall_adjusted: null,
    detected_genre: null,
    genre_confidence: null,
    score_overall: 0.34,
    risk_level: 'low' as RiskLevel,
    timestamps_similarity: [],
    rights_info: null,
    action_recommended: null,
    match_source: 'embedding',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];

// Demo forensic case
export const DEMO_FORENSIC_CASE = {
  id: 'demo-case-001',
  case_name: 'Rivera v. Santos Music Publishing',
  case_description:
    'Alleged melodic interpolation in chorus section of "Fuego" bearing substantial similarity to "Noche Original" released 2019',
  parties_involved:
    'Plaintiff: Rivera Entertainment LLC | Defendant: Santos Music Publishing Group',
  status: 'completed' as const,
  created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
};

// Realistic heatmap data (diagonal band of similarity, not random noise)
export function generateDemoHeatmapData(
  rows: number = 64,
  cols: number = 64,
): number[][] {
  const data: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) {
      let val = Math.random() * 0.12;
      // Primary similar section: bars 12-28 match bars 0-16
      if (i >= 12 && i <= 28 && j >= 0 && j <= 16) {
        const di = i - 12;
        if (Math.abs(di - j) <= 2) val = 0.7 + Math.random() * 0.25;
        else if (Math.abs(di - j) <= 4) val = 0.3 + Math.random() * 0.2;
      }
      // Secondary match: bars 45-50 match bars 30-35
      if (i >= 45 && i <= 50 && j >= 30 && j <= 35) {
        const di = i - 45;
        const dj = j - 30;
        if (Math.abs(di - dj) <= 1) val = 0.5 + Math.random() * 0.2;
      }
      row.push(Math.min(val, 1));
    }
    data.push(row);
  }
  return data;
}

// Realistic waveform (not random noise)
export function generateDemoWaveform(samples: number = 2048): number[] {
  return Array.from({ length: samples }, (_, i) => {
    const t = i / samples;
    const envelope = Math.sin(t * Math.PI) * 0.8 + 0.2;
    const verse = t < 0.3 || (t > 0.5 && t < 0.7) ? 0.6 : 1.0;
    const wave =
      Math.sin(t * 120) * 0.3 +
      Math.sin(t * 340) * 0.2 +
      Math.sin(t * 780) * 0.1;
    const noise = (Math.random() - 0.5) * 0.08;
    return (wave + noise) * envelope * verse;
  });
}

// Demo credit state
export const DEMO_CREDITS = {
  balance: 47,
  monthlyAllowance: 50,
  planTier: 'starter' as const,
  lifetimePurchased: 150,
  lifetimeUsed: 103,
};
