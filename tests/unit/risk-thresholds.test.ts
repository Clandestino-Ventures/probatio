import { describe, it, expect } from 'vitest';
import {
  RISK_THRESHOLDS,
  classifyRisk,
  getRecommendation,
} from '@/lib/analysis/risk-classifier';
import type { RiskLevel } from '@/types/database';

describe('risk thresholds', () => {
  // 1. All threshold levels have defined melody and overall values (min/max)
  it('all threshold levels have defined min and max values', () => {
    for (const threshold of RISK_THRESHOLDS) {
      expect(typeof threshold.min).toBe('number');
      expect(typeof threshold.max).toBe('number');
      expect(threshold.max).toBeGreaterThan(threshold.min);
    }
  });

  // 2. Thresholds are ordered (critical > high > moderate > low)
  it('thresholds are ordered from low to critical', () => {
    const expectedOrder: RiskLevel[] = ['low', 'moderate', 'high', 'critical'];
    const actualOrder = RISK_THRESHOLDS.map((t) => t.level);
    expect(actualOrder).toEqual(expectedOrder);

    // Also verify min values are strictly increasing
    for (let i = 1; i < RISK_THRESHOLDS.length; i++) {
      expect(RISK_THRESHOLDS[i].min).toBeGreaterThanOrEqual(
        RISK_THRESHOLDS[i - 1].min,
      );
    }
  });

  // 3. getRecommendation returns non-empty string for each level
  it('getRecommendation returns valid recommendation for each level', () => {
    const levels: RiskLevel[] = ['low', 'moderate', 'high', 'critical'];
    for (const level of levels) {
      const rec = getRecommendation(level);
      expect(rec.level).toBe(level);
      expect(rec.label.length).toBeGreaterThan(0);
      expect(rec.description.length).toBeGreaterThan(0);
      expect(rec.actions.length).toBeGreaterThan(0);
    }
  });

  // 4. classifyRisk with melody=1.0 and overall=1.0 returns 'critical'
  it('classifyRisk with score 1.0 returns "critical"', () => {
    expect(classifyRisk(1.0)).toBe('critical');
  });
});
