"use client";

import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from "recharts";
import { cn } from "@/lib/utils";
import { getRiskConfig, DIMENSION_COLORS } from "@/lib/config/risk-config";

interface DimensionRadarProps {
  scores: {
    melody: number | null;
    harmony: number | null;
    rhythm: number | null;
    timbre: number | null;
    structure?: number | null;
    lyrics?: number | null;
  };
  overallScore: number;
  riskLevel: string;
  comparisonScores?: DimensionRadarProps["scores"];  // For forensic side-by-side
  size?: number;
  className?: string;
}

export function DimensionRadar({
  scores,
  overallScore,
  riskLevel,
  comparisonScores,
  size = 280,
  className,
}: DimensionRadarProps) {
  const riskConfig = getRiskConfig(riskLevel);

  // Build data array for recharts
  const dimensions = [
    { key: "melody", label: "Melody" },
    { key: "harmony", label: "Harmony" },
    { key: "rhythm", label: "Rhythm" },
    { key: "timbre", label: "Timbre" },
  ];

  // Add structure and lyrics if they have values
  if (scores.structure != null) dimensions.push({ key: "structure", label: "Structure" });
  if (scores.lyrics != null) dimensions.push({ key: "lyrics", label: "Lyrics" });

  const data = dimensions.map(({ key, label }) => ({
    dimension: label,
    score: ((scores as Record<string, number | null>)[key] ?? 0) * 100,
    ...(comparisonScores ? {
      comparison: ((comparisonScores as Record<string, number | null>)[key] ?? 0) * 100,
    } : {}),
  }));

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid
            stroke="#3A3A3F"
            strokeDasharray="3 3"
          />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: "#8A8A8E", fontSize: 11 }}
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tick={{ fill: "#8A8A8E", fontSize: 9 }}
            tickCount={5}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke={riskConfig.color}
            fill={riskConfig.color}
            fillOpacity={0.25}
            strokeWidth={2}
          />
          {comparisonScores && (
            <Radar
              name="Comparison"
              dataKey="comparison"
              stroke="#2E6CE6"
              fill="#2E6CE6"
              fillOpacity={0.15}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          )}
        </RadarChart>
      </ResponsiveContainer>
      {/* Overall score in center */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ top: "5%" }}
      >
        <div className="text-center">
          <span
            className="text-2xl font-bold"
            style={{ color: riskConfig.color }}
          >
            {Math.round(overallScore * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
