import { describe, it, expect } from 'vitest';
import {
  computeDTW,
  computeBandedDTW,
  absoluteDistance,
  squaredDistance,
} from '@/lib/forensic/dtw';

describe('DTW (Dynamic Time Warping)', () => {
  // 1. DTW of identical sequences returns distance 0
  it('returns totalDistance 0 for identical sequences', () => {
    const series = [1, 2, 3, 4, 5];
    const result = computeDTW(series, series);
    expect(result.totalDistance).toBe(0);
    expect(result.normalizedDistance).toBe(0);
  });

  // 2. DTW of reversed sequence returns positive distance
  it('returns positive distance for reversed sequence', () => {
    const seriesA = [1, 2, 3, 4, 5];
    const seriesB = [5, 4, 3, 2, 1];
    const result = computeDTW(seriesA, seriesB);
    expect(result.totalDistance).toBeGreaterThan(0);
  });

  // 3. DTW handles sequences of different lengths
  it('handles sequences of different lengths', () => {
    const seriesA = [1, 2, 3];
    const seriesB = [1, 2, 3, 4, 5, 6];
    const result = computeDTW(seriesA, seriesB);
    expect(result.dimensions).toEqual([3, 6]);
    expect(result.path.length).toBeGreaterThan(0);
    // Path must start at (0,0) and end at (2,5)
    expect(result.path[0]).toEqual([0, 0]);
    expect(result.path[result.path.length - 1]).toEqual([2, 5]);
  });

  // 4. Banded DTW produces similar results to full DTW (within epsilon)
  it('banded DTW produces similar results to full DTW', () => {
    const seriesA = [1, 3, 5, 7, 9, 11, 13, 15];
    const seriesB = [2, 4, 6, 8, 10, 12, 14, 16];

    const fullResult = computeDTW(seriesA, seriesB);
    // Use a large enough band to cover the full matrix
    const bandedResult = computeBandedDTW(seriesA, seriesB, seriesA.length);

    // With band >= sequence length, banded DTW should match full DTW
    expect(bandedResult.totalDistance).toBeCloseTo(fullResult.totalDistance, 5);
  });
});
