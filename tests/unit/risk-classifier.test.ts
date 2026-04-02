import { describe, it, expect } from 'vitest';
import {
  classifyRisk,
  classifyRiskFromScores,
  getRecommendation,
  RISK_THRESHOLDS,
  THRESHOLD_VERSION,
} from '@/lib/analysis/risk-classifier';
import type { RiskLevel } from '@/types/database';

describe('risk-classifier', () => {
  // 1. classifyRisk returns 'critical' when melody >= 0.85
  //    (The actual API takes an overall score, not melody. We test overall >= 0.85.)
  it('classifyRisk returns "critical" when overall score is 0.85', () => {
    expect(classifyRisk(0.85)).toBe('critical');
  });

  // 2. classifyRisk returns 'critical' when overall >= 0.90
  it('classifyRisk returns "critical" when overall score is 0.90', () => {
    expect(classifyRisk(0.90)).toBe('critical');
  });

  // 3. classifyRisk returns 'high' when overall >= 0.70 but < 0.85
  it('classifyRisk returns "high" when overall score is 0.75', () => {
    expect(classifyRisk(0.75)).toBe('high');
  });

  // 4. classifyRisk returns 'moderate' when overall >= 0.40 but < 0.70
  it('classifyRisk returns "moderate" when overall score is 0.55', () => {
    expect(classifyRisk(0.55)).toBe('moderate');
  });

  // 5. classifyRisk returns 'low' when score is below 0.40
  it('classifyRisk returns "low" when overall score is 0.20', () => {
    expect(classifyRisk(0.20)).toBe('low');
  });

  // 6. Edge case: scores at exact threshold boundaries
  it('handles exact threshold boundaries correctly', () => {
    expect(classifyRisk(0.0)).toBe('low');
    expect(classifyRisk(0.4)).toBe('moderate');     // min of moderate band
    expect(classifyRisk(0.7)).toBe('high');          // min of high band
    expect(classifyRisk(0.85)).toBe('critical');     // min of critical band
    expect(classifyRisk(1.0)).toBe('critical');      // max score
  });

  // 7. Returns correct label text for each level
  it('RISK_THRESHOLDS have correct labels for each level', () => {
    const labelMap: Record<string, string> = {};
    for (const t of RISK_THRESHOLDS) {
      labelMap[t.level] = t.label;
    }
    expect(labelMap['low']).toBe('Low Risk');
    expect(labelMap['moderate']).toBe('Moderate Risk');
    expect(labelMap['high']).toBe('High Risk');
    expect(labelMap['critical']).toBe('Critical Risk');
  });

  // 8. THRESHOLD_VERSION is defined as "1.0.0"
  it('THRESHOLD_VERSION is "1.0.0"', () => {
    expect(THRESHOLD_VERSION).toBe('1.0.0');
  });
});
