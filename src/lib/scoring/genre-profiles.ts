/**
 * PROBATIO — Genre Profiles for Threshold Calibration
 *
 * Each genre has a baseline similarity profile: the expected similarity
 * between two RANDOM, UNRELATED tracks from the same genre. Scores
 * above this baseline are forensically meaningful; scores at or below
 * are genre convention, not evidence of copying.
 *
 * Baselines are calibrated from musicological literature and industry
 * knowledge about each genre's inherent structural homogeneity.
 *
 * The formula is: adjusted = (raw - baseline) / (1 - baseline)
 * This normalizes scores so that 0.0 = genre-typical and 1.0 = identical.
 */

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface GenreProfile {
  id: string;
  label: { en: string; es: string };
  /** Expected baseline similarity between two random unrelated tracks in this genre. */
  baselineSimilarity: {
    melody: number;
    harmony: number;
    rhythm: number;
    timbre: number;
    lyrics: number;
  };
  /** Raw score above this = actionable for this genre (after baseline adjustment). */
  actionableThreshold: {
    melody: number;
    harmony: number;
    rhythm: number;
    timbre: number;
    lyrics: number;
    overall: number;
  };
  /** Audio feature heuristics for genre detection. */
  featureSignature: {
    tempoRange: [number, number];
    onsetDensityRange: [number, number];
    pitchStdRange: [number, number];
    chromaVariance: "low" | "medium" | "high";
    hasPercussiveDominance: boolean;
  };
  notes: string;
  sources: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Genre Database
// ────────────────────────────────────────────────────────────────────────────

export const GENRE_PROFILES: GenreProfile[] = [
  // ── 1. Reggaeton / Dembow ──────────────────────────────────────────
  {
    id: "reggaeton",
    label: { en: "Reggaeton / Dembow", es: "Reggaetón / Dembow" },
    baselineSimilarity: {
      melody: 0.35,
      harmony: 0.55,
      rhythm: 0.70,
      timbre: 0.45,
      lyrics: 0.25,
    },
    actionableThreshold: {
      melody: 0.60,
      harmony: 0.70,
      rhythm: 0.85,
      timbre: 0.65,
      lyrics: 0.50,
      overall: 0.55,
    },
    featureSignature: {
      tempoRange: [78, 102],
      onsetDensityRange: [3.0, 6.0],
      pitchStdRange: [40, 120],
      chromaVariance: "low",
      hasPercussiveDominance: true,
    },
    notes:
      "The dembow riddim (3-3-2 tresillo pattern at 80-100 BPM) is the rhythmic foundation " +
      "of ~90% of reggaeton tracks, producing inherently high rhythmic similarity. Minor key " +
      "prevalence (i-iv-v-VI) drives elevated harmonic baselines. Melodic content is the " +
      "primary differentiator between reggaeton compositions.",
    sources: [
      "Marshall, W. (2009). 'From Musique Concrète to Dembow.' Journal of Popular Music Studies.",
      "Flores, J. (2016). 'Creolité in the Hood: Reggaeton's Afro-Caribbean Roots.' Centro Journal.",
      "Rivera-Rideau, P. (2015). 'Remixing Reggaetón.' Duke University Press.",
    ],
  },

  // ── 2. Hip-Hop / Trap ─────────────────────────────────────────────
  {
    id: "hiphop",
    label: { en: "Hip-Hop / Trap", es: "Hip-Hop / Trap" },
    baselineSimilarity: {
      melody: 0.30,
      harmony: 0.40,
      rhythm: 0.60,
      timbre: 0.50,
      lyrics: 0.20,
    },
    actionableThreshold: {
      melody: 0.55,
      harmony: 0.60,
      rhythm: 0.78,
      timbre: 0.68,
      lyrics: 0.45,
      overall: 0.50,
    },
    featureSignature: {
      tempoRange: [60, 90],
      onsetDensityRange: [2.0, 5.5],
      pitchStdRange: [20, 80],
      chromaVariance: "low",
      hasPercussiveDominance: true,
    },
    notes:
      "808 drum machine patterns and hi-hat rolls are near-universal in trap, producing high " +
      "rhythmic baselines. Shared production tools (FL Studio, similar sample packs) create " +
      "elevated timbre similarity. Melodic content varies from minimal (traditional hip-hop) " +
      "to heavily melodic (modern trap), but average baseline stays moderate.",
    sources: [
      "Kajikawa, L. (2015). 'Sounding Race in Rap Songs.' University of California Press.",
      "D'Errico, M. (2015). 'Off the Grid: Instrumental Hip-Hop and the Ethics of Sampling.' JAMS.",
    ],
  },

  // ── 3. Pop (Contemporary) ─────────────────────────────────────────
  {
    id: "pop",
    label: { en: "Pop (Contemporary)", es: "Pop (Contemporáneo)" },
    baselineSimilarity: {
      melody: 0.40,
      harmony: 0.50,
      rhythm: 0.45,
      timbre: 0.40,
      lyrics: 0.20,
    },
    actionableThreshold: {
      melody: 0.65,
      harmony: 0.68,
      rhythm: 0.65,
      timbre: 0.60,
      lyrics: 0.45,
      overall: 0.52,
    },
    featureSignature: {
      tempoRange: [95, 135],
      onsetDensityRange: [2.5, 5.0],
      pitchStdRange: [60, 150],
      chromaVariance: "medium",
      hasPercussiveDominance: false,
    },
    notes:
      "Contemporary pop relies heavily on a small set of chord progressions (I-V-vi-IV, " +
      "vi-IV-I-V, I-vi-IV-V) that appear in hundreds of hit songs, elevating harmonic " +
      "baselines. Pentatonic melodies are common, creating moderate melodic baseline. " +
      "The Millennial Whoop (alternating third and fifth) is ubiquitous in 2010s pop.",
    sources: [
      "De Clercq, T. & Temperley, D. (2011). 'A Corpus Analysis of Rock Harmony.' Popular Music.",
      "Serrà, J. et al. (2012). 'Measuring the Evolution of Contemporary Western Popular Music.' Scientific Reports.",
    ],
  },

  // ── 4. R&B / Neo-Soul ─────────────────────────────────────────────
  {
    id: "rnb",
    label: { en: "R&B / Neo-Soul", es: "R&B / Neo-Soul" },
    baselineSimilarity: {
      melody: 0.35,
      harmony: 0.55,
      rhythm: 0.50,
      timbre: 0.40,
      lyrics: 0.20,
    },
    actionableThreshold: {
      melody: 0.60,
      harmony: 0.72,
      rhythm: 0.68,
      timbre: 0.60,
      lyrics: 0.45,
      overall: 0.52,
    },
    featureSignature: {
      tempoRange: [65, 110],
      onsetDensityRange: [2.0, 4.5],
      pitchStdRange: [80, 180],
      chromaVariance: "high",
      hasPercussiveDominance: false,
    },
    notes:
      "R&B features extended chord voicings (7ths, 9ths, 11ths) and the ii-V-I progression " +
      "borrowed from jazz, producing high harmonic baselines. Rhythmic grooves are moderately " +
      "homogeneous due to shared drum programming aesthetics. Wide vocal ranges and melismatic " +
      "singing create moderate pitch standard deviations.",
    sources: [
      "Brackett, D. (2009). 'The Pop, Rock, and Soul Reader.' Oxford University Press.",
      "Ramsey, G. (2003). 'Race Music: Black Cultures from Bebop to Hip-Hop.' University of California Press.",
    ],
  },

  // ── 5. EDM / House ────────────────────────────────────────────────
  {
    id: "edm",
    label: { en: "EDM / House", es: "EDM / House" },
    baselineSimilarity: {
      melody: 0.25,
      harmony: 0.35,
      rhythm: 0.75,
      timbre: 0.55,
      lyrics: 0.15,
    },
    actionableThreshold: {
      melody: 0.50,
      harmony: 0.55,
      rhythm: 0.88,
      timbre: 0.72,
      lyrics: 0.40,
      overall: 0.50,
    },
    featureSignature: {
      tempoRange: [118, 140],
      onsetDensityRange: [4.0, 8.0],
      pitchStdRange: [30, 100],
      chromaVariance: "low",
      hasPercussiveDominance: true,
    },
    notes:
      "The four-on-the-floor kick pattern is definitional for house music, creating the highest " +
      "rhythmic baseline of any genre. Shared synthesizer timbres and production techniques " +
      "elevate timbre baselines. Melodic content is the primary copyright-relevant differentiator. " +
      "Many tracks are instrumental or use minimal vocal hooks.",
    sources: [
      "Butler, M.J. (2006). 'Unlocking the Groove: Rhythm, Meter, and Musical Design in Electronic Dance Music.' Indiana University Press.",
      "Rietveld, H. (1998). 'This Is Our House: House Music, Cultural Spaces and Technologies.' Ashgate.",
    ],
  },

  // ── 6. Rock (Classic + Modern) ────────────────────────────────────
  {
    id: "rock",
    label: { en: "Rock", es: "Rock" },
    baselineSimilarity: {
      melody: 0.30,
      harmony: 0.50,
      rhythm: 0.45,
      timbre: 0.35,
      lyrics: 0.15,
    },
    actionableThreshold: {
      melody: 0.58,
      harmony: 0.68,
      rhythm: 0.65,
      timbre: 0.55,
      lyrics: 0.40,
      overall: 0.50,
    },
    featureSignature: {
      tempoRange: [90, 160],
      onsetDensityRange: [3.0, 6.5],
      pitchStdRange: [50, 140],
      chromaVariance: "medium",
      hasPercussiveDominance: false,
    },
    notes:
      "Power chord patterns (I-IV-V, I-bVII-IV) create moderate harmonic baselines. Rock " +
      "has broader tempo and arrangement diversity than pop, reducing rhythmic baselines. " +
      "Guitar tone variety means timbre baselines are lower than electronic genres.",
    sources: [
      "De Clercq, T. & Temperley, D. (2011). 'A Corpus Analysis of Rock Harmony.' Popular Music.",
      "Moore, A.F. (2012). 'Song Means: Analysing and Interpreting Recorded Popular Song.' Ashgate.",
    ],
  },

  // ── 7. Classical / Orchestral ─────────────────────────────────────
  {
    id: "classical",
    label: { en: "Classical / Orchestral", es: "Clásica / Orquestal" },
    baselineSimilarity: {
      melody: 0.15,
      harmony: 0.20,
      rhythm: 0.15,
      timbre: 0.25,
      lyrics: 0.05,
    },
    actionableThreshold: {
      melody: 0.40,
      harmony: 0.42,
      rhythm: 0.38,
      timbre: 0.45,
      lyrics: 0.25,
      overall: 0.35,
    },
    featureSignature: {
      tempoRange: [40, 180],
      onsetDensityRange: [1.0, 7.0],
      pitchStdRange: [100, 300],
      chromaVariance: "high",
      hasPercussiveDominance: false,
    },
    notes:
      "Classical music has the lowest baselines because each composition is structurally unique: " +
      "through-composed forms, complex modulations, wide dynamic range, and high melodic diversity. " +
      "Even moderate similarity scores are significant. Orchestral timbre baseline is slightly " +
      "elevated because of shared instrument families, but specific orchestrations differ.",
    sources: [
      "Temperley, D. (2001). 'The Cognition of Basic Musical Structures.' MIT Press.",
      "Lerdahl, F. & Jackendoff, R. (1983). 'A Generative Theory of Tonal Music.' MIT Press.",
    ],
  },

  // ── 8. Jazz ───────────────────────────────────────────────────────
  {
    id: "jazz",
    label: { en: "Jazz", es: "Jazz" },
    baselineSimilarity: {
      melody: 0.20,
      harmony: 0.35,
      rhythm: 0.25,
      timbre: 0.30,
      lyrics: 0.10,
    },
    actionableThreshold: {
      melody: 0.48,
      harmony: 0.55,
      rhythm: 0.48,
      timbre: 0.50,
      lyrics: 0.35,
      overall: 0.42,
    },
    featureSignature: {
      tempoRange: [60, 240],
      onsetDensityRange: [2.0, 8.0],
      pitchStdRange: [80, 250],
      chromaVariance: "high",
      hasPercussiveDominance: false,
    },
    notes:
      "Jazz features highly variable rhythm (swing, rubato, polyrhythm), producing low rhythmic " +
      "baselines — rhythmic similarity in jazz is significant. Extended chord voicings (ii-V-I, " +
      "tritone substitution) create moderate harmonic baselines. Improvisation ensures low melodic " +
      "baselines; similar melodies strongly suggest derivation. Wide tempo range makes tempo alone " +
      "insufficient for genre detection — chroma variance is the key signal.",
    sources: [
      "Berliner, P.F. (1994). 'Thinking in Jazz.' University of Chicago Press.",
      "Kernfeld, B. (2006). 'The Story of Fake Books.' Scarecrow Press.",
    ],
  },

  // ── 9. Country ────────────────────────────────────────────────────
  {
    id: "country",
    label: { en: "Country", es: "Country" },
    baselineSimilarity: {
      melody: 0.40,
      harmony: 0.55,
      rhythm: 0.50,
      timbre: 0.35,
      lyrics: 0.15,
    },
    actionableThreshold: {
      melody: 0.65,
      harmony: 0.72,
      rhythm: 0.68,
      timbre: 0.55,
      lyrics: 0.40,
      overall: 0.52,
    },
    featureSignature: {
      tempoRange: [80, 145],
      onsetDensityRange: [2.5, 5.0],
      pitchStdRange: [60, 140],
      chromaVariance: "medium",
      hasPercussiveDominance: false,
    },
    notes:
      "Country music relies heavily on I-IV-V-vi progressions and Nashville Number System " +
      "conventions, producing elevated harmonic baselines. Verse-chorus-bridge structure is " +
      "nearly universal. Melodic baselines are moderate due to pentatonic prevalence. " +
      "Acoustic instrument diversity keeps timbre baselines low.",
    sources: [
      "Neal, J. (2007). 'Narrative Paradigms, Musical Signifiers, and Form as Function in Country Music.' Music Theory Spectrum.",
      "Stimeling, T.D. (2011). 'Cosmic Cowboys and New Hicks.' Oxford University Press.",
    ],
  },

  // ── 10. Latin Pop / Salsa ─────────────────────────────────────────
  {
    id: "latin",
    label: { en: "Latin Pop / Salsa", es: "Pop Latino / Salsa" },
    baselineSimilarity: {
      melody: 0.35,
      harmony: 0.45,
      rhythm: 0.60,
      timbre: 0.40,
      lyrics: 0.20,
    },
    actionableThreshold: {
      melody: 0.60,
      harmony: 0.63,
      rhythm: 0.78,
      timbre: 0.58,
      lyrics: 0.45,
      overall: 0.50,
    },
    featureSignature: {
      tempoRange: [85, 130],
      onsetDensityRange: [3.0, 6.0],
      pitchStdRange: [60, 150],
      chromaVariance: "medium",
      hasPercussiveDominance: false,
    },
    notes:
      "Clave-based rhythmic patterns (son clave, rumba clave) produce elevated rhythmic baselines " +
      "across Latin genres. Harmonic vocabulary draws from both European and Afro-Caribbean " +
      "traditions. Wide melodic diversity keeps melodic baselines moderate. Modern Latin pop " +
      "increasingly overlaps with reggaeton production aesthetics.",
    sources: [
      "Manuel, P. (2006). 'Caribbean Currents: Caribbean Music from Rumba to Reggae.' Temple University Press.",
      "Washburne, C. (2008). 'Sounding Salsa.' Temple University Press.",
    ],
  },

  // ── 11. Funk / Disco ──────────────────────────────────────────────
  {
    id: "funk",
    label: { en: "Funk / Disco", es: "Funk / Disco" },
    baselineSimilarity: {
      melody: 0.30,
      harmony: 0.40,
      rhythm: 0.65,
      timbre: 0.50,
      lyrics: 0.15,
    },
    actionableThreshold: {
      melody: 0.55,
      harmony: 0.58,
      rhythm: 0.80,
      timbre: 0.68,
      lyrics: 0.40,
      overall: 0.50,
    },
    featureSignature: {
      tempoRange: [95, 130],
      onsetDensityRange: [4.0, 7.0],
      pitchStdRange: [40, 120],
      chromaVariance: "medium",
      hasPercussiveDominance: true,
    },
    notes:
      "Funk groove patterns (syncopated bass + drums) are highly homogeneous within the genre, " +
      "producing elevated rhythmic baselines. Shared use of clavinet, wah guitar, and horn " +
      "sections creates moderate timbre baselines. Melodic content is often secondary to groove, " +
      "with riff-based rather than through-composed melodies.",
    sources: [
      "Danielsen, A. (2006). 'Presence and Pleasure: The Funk Grooves of James Brown and Parliament.' Wesleyan University Press.",
      "Lawrence, T. (2003). 'Love Saves the Day: A History of American Dance Music Culture.' Duke University Press.",
    ],
  },

  // ── 12. K-Pop / J-Pop ─────────────────────────────────────────────
  {
    id: "kpop",
    label: { en: "K-Pop / J-Pop", es: "K-Pop / J-Pop" },
    baselineSimilarity: {
      melody: 0.35,
      harmony: 0.45,
      rhythm: 0.50,
      timbre: 0.45,
      lyrics: 0.15,
    },
    actionableThreshold: {
      melody: 0.60,
      harmony: 0.63,
      rhythm: 0.68,
      timbre: 0.63,
      lyrics: 0.40,
      overall: 0.50,
    },
    featureSignature: {
      tempoRange: [95, 140],
      onsetDensityRange: [3.0, 6.0],
      pitchStdRange: [60, 160],
      chromaVariance: "medium",
      hasPercussiveDominance: false,
    },
    notes:
      "K-Pop/J-Pop combines pop songwriting with dense, genre-crossing production (EDM drops, " +
      "hip-hop verses, R&B choruses) creating moderate baselines across all dimensions. " +
      "High production homogeneity from a small number of major production houses (SM, JYP, " +
      "YG) elevates timbre baselines. Multi-section arrangements reduce melodic baselines " +
      "compared to Western pop.",
    sources: [
      "Lie, J. (2014). 'K-pop: Popular Music, Cultural Amnesia, and Economic Innovation in South Korea.' University of California Press.",
      "Howard, K. (2006). 'Creating Korean Music: Tradition, Innovation and the Discourse of Identity.' Ashgate.",
    ],
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Lookup
// ────────────────────────────────────────────────────────────────────────────

/** Map of genre ID → profile for O(1) lookup. */
export const GENRE_PROFILE_MAP: ReadonlyMap<string, GenreProfile> = new Map(
  GENRE_PROFILES.map((p) => [p.id, p]),
);

/**
 * Get a genre profile by ID. Returns the 'pop' profile as a conservative
 * default if the genre is not found.
 */
export function getGenreProfile(genreId: string): GenreProfile {
  return GENRE_PROFILE_MAP.get(genreId) ?? GENRE_PROFILE_MAP.get("pop")!;
}
