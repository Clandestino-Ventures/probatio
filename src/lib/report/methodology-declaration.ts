/**
 * PROBATIO — Methodology Declaration
 *
 * A standalone document describing the analysis methodology.
 * An expert witness can reference or sign this as part of testimony.
 * Populated with actual pipeline version details.
 */

interface PipelineVersionInfo {
  versionTag: string;
  demucsModel: string;
  demucsVersion: string;
  crepeModel: string;
  crepeVersion: string;
  clapModel: string;
  clapVersion: string;
  librosaVersion: string;
}

export function generateMethodologyDeclaration(
  pipeline: PipelineVersionInfo
): string {
  return `DECLARATION OF METHODOLOGY
Probatio Forensic Audio Analysis Platform
Pipeline Version: ${pipeline.versionTag}
Generated: ${new Date().toISOString().split("T")[0]}

═══════════════════════════════════════════════════════════════

1. SYSTEM OVERVIEW

Probatio is an automated forensic audio analysis platform that compares
musical recordings across multiple dimensions of similarity: melody,
harmony, rhythm, and timbre. The system produces quantitative similarity
scores, identifies specific temporal segments of similarity, and
maintains a cryptographic chain of custody throughout the analysis.

2. ANALYSIS PIPELINE

2.1 Audio Ingestion and Chain of Custody
    - SHA-256 hash computed client-side before upload
    - Server-side hash verification (tamper detection)
    - Every processing step recorded in an immutable hash chain
    - Hash chain enforced by database triggers (append-only)

2.2 Audio Normalization
    - Target format: 44,100 Hz, 16-bit, mono PCM
    - Loudness normalization to consistent reference level
    - SHA-256 hash of normalized output recorded

2.3 Source Separation
    - Model: Demucs (${pipeline.demucsModel}, version ${pipeline.demucsVersion})
    - Separates audio into four stems: vocals, bass, drums, other
    - Determinism enforced: fixed random seed (42), deterministic CUDA operations
    - Each stem individually SHA-256 hashed

2.4 Feature Extraction
    - Pitch Contour: CREPE neural network (${pipeline.crepeModel} capacity, v${pipeline.crepeVersion})
      10ms step size, Viterbi smoothing, confidence threshold 0.5
    - Chroma Features: Constant-Q Transform chromagram (librosa v${pipeline.librosaVersion})
      12-bin pitch class profile per time frame
    - Rhythm: Onset strength envelope, beat tracking, tempo estimation
    - Structure: MFCC-based recurrence matrix with novelty detection
    - Key Estimation: Krumhansl-Schmuckler algorithm on chroma profile

2.5 Probatiol Embeddings
    - Model: CLAP (${pipeline.clapModel}, version ${pipeline.clapVersion})
    - 512-dimensional embeddings per dimension:
      * Timbre: full mix embedding
      * Melody: vocals stem embedding
      * Harmony: bass + other stems (mixed) embedding
      * Rhythm: drums stem embedding
    - Segment-level embeddings: 4-second windows, 2-second hop
    - All embeddings L2-normalized to unit length

2.6 Similarity Comparison
    - Dynamic Time Warping (DTW) for temporal alignment
    - Bidirectional alignment: A→B and B→A independently
    - 12-semitone transposition detection (-6 to +5 semitones)
    - Cosine similarity for embedding comparison
    - Chroma correlation for harmonic analysis
    - Onset pattern correlation for rhythmic analysis

2.7 Risk Classification
    - Critical: ≥85% overall weighted similarity
    - High: ≥60%
    - Moderate: ≥30%
    - Low: >10%
    - Clear: ≤10%
    - Dimension weights: Melody 35%, Harmony 25%, Timbre 25%, Rhythm 15%

3. SCIENTIFIC BASIS

The algorithms employed are based on established techniques published
in peer-reviewed venues:

    - Défossez, A., et al. "Music Source Separation in the Waveform
      Domain." arXiv:1911.13254 (2019/2021). [Demucs]
    - Kim, J.W., et al. "CREPE: A Convolutional Representation for
      Pitch Estimation." ICASSP 2018. [Pitch detection]
    - Wu, Y., et al. "Large-Scale Contrastive Language-Audio
      Pretraining with Feature Fusion and Keyword-to-Caption
      Augmentation." ICASSP 2023. [CLAP embeddings]
    - Müller, M. "Fundamentals of Music Processing." Springer, 2015.
      [DTW, chroma analysis, structural analysis]
    - Krumhansl, C.L. "Cognitive Foundations of Musical Pitch."
      Oxford University Press, 1990. [Key estimation]

4. REPRODUCIBILITY

All model versions and parameters are pinned to pipeline version
${pipeline.versionTag}. Given identical input audio and the same pipeline
version, the analysis produces identical output. This is enforced by:
    - Fixed random seeds across all stochastic processes
    - Deterministic GPU computation (CUDA deterministic mode)
    - Pinned library versions (no floating dependencies)
    - Normalized audio format (eliminates codec variability)

5. KNOWN LIMITATIONS

    - Audio quality degradation (compression, noise) may affect results
    - Common musical patterns (I-IV-V-I progressions, standard drum
      patterns) may produce elevated similarity scores
    - The system analyzes recorded audio signals, not musical notation,
      lyrics, or artistic intent
    - Similarity does not establish legal infringement; that
      determination requires consideration of access, originality,
      and other legal factors
    - Short audio segments (<4 seconds) may have insufficient data
      for reliable comparison
    - The system cannot assess the originality or creative merit of
      the works being compared

6. CHAIN OF CUSTODY VERIFICATION

The integrity of the analysis can be independently verified by:
    1. Recomputing the SHA-256 hash of the input audio files
    2. Verifying each entry in the custody chain links to the previous
       entry via its hash (Merkle chain structure)
    3. Running the analysis with the same pipeline version and
       confirming identical output

7. EXPERT QUALIFICATIONS

[This section to be completed by the certifying expert witness]

Name: _________________________________________________
Title: ________________________________________________
Organization: _________________________________________
Bar Number / License: _________________________________
Date: _________________________________________________
Signature: ____________________________________________

═══════════════════════════════════════════════════════════════

This declaration describes the Probatio methodology as of pipeline
version ${pipeline.versionTag}. The methodology is subject to
refinement. Any material changes result in a new pipeline version.

Generated by Probatio (probatio.audio)
© ${new Date().getFullYear()} Clandestino Ventures, LLC. All rights reserved.
`;
}
