/**
 * PROBATIO — Risk Level Configuration
 * Centralized risk colors, labels, and descriptions used across
 * visualizations, badges, and reports.
 */

export type RiskLevel = "clear" | "low" | "moderate" | "high" | "critical";

export interface RiskLevelConfig {
  level: RiskLevel;
  label: string;
  labelEs: string;
  color: string;        // hex color
  bgColor: string;      // hex bg (lighter)
  tailwindText: string;  // Tailwind text class
  tailwindBg: string;    // Tailwind bg class
  description: string;
  action: string;
}

export const RISK_CONFIG: Record<RiskLevel, RiskLevelConfig> = {
  clear: {
    level: "clear",
    label: "Clear",
    labelEs: "Libre",
    color: "#22C55E",
    bgColor: "#22C55E20",
    tailwindText: "text-risk-low",
    tailwindBg: "bg-risk-low/10",
    description: "No significant similarities detected",
    action: "No action required",
  },
  low: {
    level: "low",
    label: "Low",
    labelEs: "Bajo",
    color: "#22C55E",
    bgColor: "#22C55E20",
    tailwindText: "text-risk-low",
    tailwindBg: "bg-risk-low/10",
    description: "Minor similarities within genre conventions",
    action: "Monitor if track evolves",
  },
  moderate: {
    level: "moderate",
    label: "Moderate",
    labelEs: "Moderado",
    color: "#F59E0B",
    bgColor: "#F59E0B20",
    tailwindText: "text-risk-moderate",
    tailwindBg: "bg-risk-moderate/10",
    description: "Notable similar patterns detected",
    action: "Legal review recommended before release",
  },
  high: {
    level: "high",
    label: "High",
    labelEs: "Alto",
    color: "#F97316",
    bgColor: "#F9731620",
    tailwindText: "text-risk-high",
    tailwindBg: "bg-risk-high/10",
    description: "Substantial similarity across multiple dimensions",
    action: "Obtain clearance or legal opinion before distribution",
  },
  critical: {
    level: "critical",
    label: "Critical",
    labelEs: "Cr\u00edtico",
    color: "#E63926",
    bgColor: "#E6392620",
    tailwindText: "text-signal-red",
    tailwindBg: "bg-signal-red/10",
    description: "Near-identical similarity detected",
    action: "Do not release without clearance from rights holders",
  },
};

// Dimension colors for visualizations
export const DIMENSION_COLORS: Record<string, string> = {
  melody: "#2E6CE6",      // forensic-blue
  harmony: "#C4992E",     // evidence-gold
  rhythm: "#E63926",      // signal-red
  timbre: "#8A8A8E",      // ash
  lyrics: "#22C55E",      // risk-low
  structure: "#F59E0B",   // risk-moderate
};

export const DIMENSION_LABELS: Record<string, string> = {
  melody: "Melody",
  harmony: "Harmony",
  rhythm: "Rhythm",
  timbre: "Timbre",
  lyrics: "Lyrics",
  structure: "Structure",
};

export function getRiskConfig(level: string): RiskLevelConfig {
  return RISK_CONFIG[level as RiskLevel] ?? RISK_CONFIG.low;
}
