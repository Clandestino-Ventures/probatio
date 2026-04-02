import { describe, it, expect } from "vitest";
import {
  computeTranspositionAwareDTW,
  computeDTWWithTransposition,
  hzToMidi,
  hzArrayToMidi,
  pitchToIntervals,
  semitonesToIntervalName,
  crossValidateTransposition,
} from "@/lib/forensic/dtw";

describe("Transposition Detection", () => {
  it("detects identical melody transposed up 3 semitones", () => {
    const contourA = [60, 62, 64, 65, 67]; // C D E F G (MIDI)
    const contourB = [63, 65, 67, 68, 70]; // Eb F G Ab Bb (+3)
    const result = computeTranspositionAwareDTW(contourA, contourB);
    expect(result.similarity).toBeGreaterThan(0.90);
    expect(result.transposition_semitones).toBe(3);
    expect(result.transposition_name).toBe("Up minor 3rd");
  });

  it("detects identical melody transposed down 2 semitones", () => {
    const contourA = [60, 62, 64, 65, 67];
    const contourB = [58, 60, 62, 63, 65]; // -2
    const result = computeTranspositionAwareDTW(contourA, contourB);
    expect(result.transposition_semitones).toBe(-2);
    expect(result.transposition_name).toBe("Down major 2nd (whole step)");
  });

  it("same key melody returns transposition = 0", () => {
    const contour = [60, 62, 64, 65, 67];
    const result = computeTranspositionAwareDTW(contour, contour);
    expect(result.transposition_semitones).toBe(0);
    expect(result.similarity).toBeGreaterThan(0.99);
    expect(result.transposition_name).toBe("Same key");
  });

  it("completely different melodies have low similarity regardless of transposition", () => {
    const contourA = [60, 72, 48, 84, 36]; // Random jumps
    const contourB = [65, 63, 61, 59, 57]; // Descending scale
    const result = computeTranspositionAwareDTW(contourA, contourB);
    expect(result.similarity).toBeLessThan(0.5);
  });

  it("interval method matches transposition search for clean transposition", () => {
    const contourA = [60, 62, 64, 65, 67];
    const contourB = [64, 66, 68, 69, 71]; // +4
    const result = computeTranspositionAwareDTW(contourA, contourB);
    expect(result.interval_similarity).toBeGreaterThan(0.85);
    expect(result.transposition_similarity).toBeGreaterThan(0.85);
  });

  it("reports all 12 transpositions tried", () => {
    const contourA = [60, 62, 64, 65, 67];
    const contourB = [63, 65, 67, 68, 70];
    const result = computeTranspositionAwareDTW(contourA, contourB);
    expect(result.allTranspositions.length).toBe(12);
    // Each transposition has semitones, distance, similarity
    for (const t of result.allTranspositions) {
      expect(typeof t.semitones).toBe("number");
      expect(typeof t.distance).toBe("number");
      expect(typeof t.similarity).toBe("number");
      expect(t.similarity).toBeGreaterThanOrEqual(0);
      expect(t.similarity).toBeLessThanOrEqual(1);
    }
  });
});

describe("Hz to MIDI Conversion", () => {
  it("converts 440 Hz to MIDI 69 (A4)", () => {
    expect(hzToMidi(440)).toBeCloseTo(69, 5);
  });

  it("converts 261.63 Hz to MIDI 60 (C4)", () => {
    expect(hzToMidi(261.63)).toBeCloseTo(60, 0);
  });

  it("converts 0 Hz to MIDI 0 (silence)", () => {
    expect(hzToMidi(0)).toBe(0);
  });

  it("converts negative Hz to 0 (invalid)", () => {
    expect(hzToMidi(-100)).toBe(0);
  });

  it("hzArrayToMidi converts batch correctly", () => {
    const hz = [261.63, 293.66, 329.63, 349.23, 392.0]; // C D E F G
    const midi = hzArrayToMidi(hz);
    expect(midi[0]).toBeCloseTo(60, 0);
    expect(midi[4]).toBeCloseTo(67, 0);
    expect(midi.length).toBe(5);
  });
});

describe("Pitch to Intervals", () => {
  it("computes correct intervals for C major scale", () => {
    const cmajor = [60, 62, 64, 65, 67]; // C D E F G
    const intervals = pitchToIntervals(cmajor);
    expect(intervals).toEqual([2, 2, 1, 2]);
  });

  it("filters out silence (MIDI 0)", () => {
    const contour = [60, 0, 62, 0, 64];
    const intervals = pitchToIntervals(contour);
    // Voiced: [60, 62, 64] → intervals: [2, 2]
    expect(intervals).toEqual([2, 2]);
  });

  it("returns empty for single-note contour", () => {
    expect(pitchToIntervals([60])).toEqual([]);
  });

  it("returns empty for all-silence contour", () => {
    expect(pitchToIntervals([0, 0, 0])).toEqual([]);
  });

  it("transposed melodies produce identical intervals", () => {
    const cMajor = [60, 62, 64, 65, 67]; // C D E F G
    const ebMajor = [63, 65, 67, 68, 70]; // Eb F G Ab Bb (+3)
    expect(pitchToIntervals(cMajor)).toEqual(pitchToIntervals(ebMajor));
  });
});

describe("Interval Names", () => {
  it("returns correct names for all standard intervals", () => {
    expect(semitonesToIntervalName(0)).toBe("Same key");
    expect(semitonesToIntervalName(1)).toBe("Up minor 2nd (half step)");
    expect(semitonesToIntervalName(2)).toBe("Up major 2nd (whole step)");
    expect(semitonesToIntervalName(3)).toBe("Up minor 3rd");
    expect(semitonesToIntervalName(4)).toBe("Up major 3rd");
    expect(semitonesToIntervalName(5)).toBe("Up perfect 4th");
    expect(semitonesToIntervalName(6)).toBe("Up tritone");
    expect(semitonesToIntervalName(-1)).toBe("Down minor 2nd (half step)");
    expect(semitonesToIntervalName(-2)).toBe("Down major 2nd (whole step)");
    expect(semitonesToIntervalName(-3)).toBe("Down minor 3rd");
    expect(semitonesToIntervalName(-4)).toBe("Down major 3rd");
    expect(semitonesToIntervalName(-5)).toBe("Down perfect 4th");
    expect(semitonesToIntervalName(-6)).toBe("Down tritone");
  });

  it("returns fallback for non-standard intervals", () => {
    expect(semitonesToIntervalName(7)).toContain("7");
    expect(semitonesToIntervalName(-8)).toContain("-8");
  });
});

describe("Chroma Cross-Validation", () => {
  it("high confidence when transposition + high chroma similarity", () => {
    const result = crossValidateTransposition(3, 0.85, 0.75);
    expect(result.confidence).toBe("high");
    expect(result.explanation).toContain("confirms");
  });

  it("medium confidence when transposition + low chroma similarity", () => {
    const result = crossValidateTransposition(3, 0.65, 0.30);
    expect(result.confidence).toBe("medium");
    expect(result.explanation).toContain("human review");
  });

  it("high confidence when same key + high chroma", () => {
    const result = crossValidateTransposition(0, 0.80, 0.70);
    expect(result.confidence).toBe("high");
    expect(result.explanation).toContain("No transposition");
  });

  it("low confidence when everything is low", () => {
    const result = crossValidateTransposition(0, 0.30, 0.25);
    expect(result.confidence).toBe("low");
    expect(result.explanation).toContain("inconclusive");
  });
});

describe("Legacy computeDTWWithTransposition", () => {
  it("still works with Hz frequency inputs", () => {
    // C major scale in Hz
    const freqA = [261.63, 293.66, 329.63, 349.23, 392.0];
    // Same scale +3 semitones (Eb major)
    const freqB = [311.13, 349.23, 392.0, 415.3, 466.16];

    const result = computeDTWWithTransposition(freqA, freqB);
    expect(result.bestSimilarity).toBeGreaterThan(0.5);
    expect(result.allTranspositions.length).toBe(12);
    // The best transposition should be near +3 or -3
    expect(Math.abs(result.transpositionSemitones)).toBeLessThanOrEqual(6);
  });
});
