import { describe, it, expect, vi } from 'vitest';

// Polyfill crypto.subtle for the jsdom/node test environment
if (!globalThis.crypto?.subtle) {
  const { webcrypto } = await import('node:crypto');
  vi.stubGlobal('crypto', webcrypto);
}

import {
  computeStringSHA256,
  verifyChain,
  createAuditEntry,
} from '@/lib/analysis/chain-of-custody';
import type { ChainOfCustodyEntry } from '@/types/forensic';

describe('chain-of-custody', () => {
  // 1. computeStringSHA256 returns consistent hash for same input
  it('computeStringSHA256 returns consistent hash for same input', async () => {
    const hash1 = await computeStringSHA256('hello');
    const hash2 = await computeStringSHA256('hello');
    expect(hash1).toBe(hash2);
  });

  // 2. computeStringSHA256 returns different hashes for different inputs
  it('computeStringSHA256 returns different hashes for different inputs', async () => {
    const hash1 = await computeStringSHA256('hello');
    const hash2 = await computeStringSHA256('world');
    expect(hash1).not.toBe(hash2);
  });

  // 3. computeStringSHA256 handles empty string
  it('computeStringSHA256 handles empty string', async () => {
    const hash = await computeStringSHA256('');
    // SHA-256 of empty string is well-known:
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  // 4. computeStringSHA256 handles unicode (Spanish text)
  it('computeStringSHA256 handles unicode text', async () => {
    const hash = await computeStringSHA256('análisis forense');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(64);
    // Verify consistency
    const hash2 = await computeStringSHA256('análisis forense');
    expect(hash).toBe(hash2);
  });

  // 5. Hash output is 64-char hex string
  it('hash output is a 64-character hex string', async () => {
    const hash = await computeStringSHA256('test input');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  // 6. verifyChain detects broken chain
  it('verifyChain detects a broken hash chain', () => {
    const validChain: ChainOfCustodyEntry[] = [
      {
        sequence: 0,
        timestamp: new Date().toISOString(),
        actor: 'system',
        action: 'upload',
        hashAfter: 'abc123',
        hashBefore: null,
        ipAddress: null,
        metadata: null,
      },
      {
        sequence: 1,
        timestamp: new Date().toISOString(),
        actor: 'system',
        action: 'normalize',
        hashAfter: 'def456',
        hashBefore: 'abc123', // matches previous hashAfter
        ipAddress: null,
        metadata: null,
      },
    ];

    // Valid chain should pass
    const validResult = verifyChain(validChain);
    expect(validResult.valid).toBe(true);
    expect(validResult.brokenAtIndex).toBe(-1);

    // Break the chain by modifying hashBefore of second entry
    const brokenChain: ChainOfCustodyEntry[] = [
      { ...validChain[0] },
      {
        ...validChain[1],
        hashBefore: 'WRONG_HASH', // does NOT match previous hashAfter
      },
    ];

    const brokenResult = verifyChain(brokenChain);
    expect(brokenResult.valid).toBe(false);
    expect(brokenResult.brokenAtIndex).toBe(1);
    expect(brokenResult.error).toContain('Broken hash chain');
  });
});
