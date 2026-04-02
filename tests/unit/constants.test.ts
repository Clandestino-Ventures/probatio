import { describe, it, expect } from 'vitest';
import { PIPELINE_STEPS, SUPPORTED_FORMATS } from '@/lib/constants';

describe('constants', () => {
  // 1. PIPELINE_STEPS has exactly 6 entries
  it('PIPELINE_STEPS has exactly 6 entries', () => {
    expect(PIPELINE_STEPS).toHaveLength(6);
    expect(PIPELINE_STEPS).toEqual([
      'upload',
      'normalize',
      'separate',
      'extract',
      'match',
      'classify',
    ]);
  });

  // 2. SUPPORTED_FORMATS includes wav, mp3, flac
  it('SUPPORTED_FORMATS includes wav, mp3, and flac', () => {
    expect(SUPPORTED_FORMATS).toContain('wav');
    expect(SUPPORTED_FORMATS).toContain('mp3');
    expect(SUPPORTED_FORMATS).toContain('flac');
  });
});
