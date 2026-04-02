import { describe, it, expect } from 'vitest';
import {
  formatFileSize,
  formatDuration,
  truncateHash,
  cn,
} from '@/lib/utils';

describe('utils', () => {
  // 1. formatFileSize formats bytes correctly
  describe('formatFileSize', () => {
    it('formats 0 bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
    });

    it('formats 1024 bytes as 1.00 KB', () => {
      expect(formatFileSize(1024)).toBe('1.00 KB');
    });

    it('formats 1048576 bytes as 1.00 MB', () => {
      expect(formatFileSize(1048576)).toBe('1.00 MB');
    });
  });

  // 2. formatDuration formats seconds correctly
  describe('formatDuration', () => {
    it('formats 0 seconds as 00:00', () => {
      expect(formatDuration(0)).toBe('00:00');
    });

    it('formats 65 seconds as 01:05', () => {
      expect(formatDuration(65)).toBe('01:05');
    });

    it('formats 3661 seconds as 01:01:01', () => {
      expect(formatDuration(3661)).toBe('01:01:01');
    });
  });

  // 3. truncateHash truncates long hashes and preserves short ones
  describe('truncateHash', () => {
    it('truncates a 64-char hash', () => {
      const hash = 'a'.repeat(64);
      const result = truncateHash(hash);
      expect(result).toBe('aaaaaaaa...aaaaaaaa');
      expect(result.length).toBe(19); // 8 + 3 + 8
    });

    it('preserves short hashes that fit within prefix+suffix', () => {
      const shortHash = 'abcdef';
      expect(truncateHash(shortHash)).toBe('abcdef');
    });
  });

  // 4. cn merges Tailwind classes correctly
  describe('cn', () => {
    it('merges classes and resolves Tailwind conflicts', () => {
      const result = cn('px-4 py-2', 'px-6');
      expect(result).toContain('px-6');
      expect(result).not.toContain('px-4');
      expect(result).toContain('py-2');
    });

    it('handles conditional classes', () => {
      const result = cn('base', false && 'hidden', 'extra');
      expect(result).toContain('base');
      expect(result).toContain('extra');
      expect(result).not.toContain('hidden');
    });
  });
});
