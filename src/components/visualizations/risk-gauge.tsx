"use client";

import { cn } from "@/lib/utils";
import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// Brand Colors
// ────────────────────────────────────────────────────────────────────────────

const GRAPHITE = "#1E1E21";
const RISK_LOW = "#22C55E";
const RISK_MODERATE = "#F59E0B";
const RISK_HIGH = "#F97316";
const SIGNAL_RED = "#E63926";
const BONE = "#F5F0EB";
const ASH = "#8A8A8E";

// ────────────────────────────────────────────────────────────────────────────
// Risk Level Logic
// ────────────────────────────────────────────────────────────────────────────

function getRiskLevel(value: number): { label: string; color: string } {
  if (value < 40) return { label: "Low", color: RISK_LOW };
  if (value < 55) return { label: "Medium", color: RISK_MODERATE };
  if (value < 85) return { label: "High", color: RISK_HIGH };
  return { label: "Critical", color: SIGNAL_RED };
}

/**
 * Return the arc color at a given percentage along the gauge (0-100).
 */
function arcColorAt(pct: number): string {
  if (pct <= 40) return RISK_LOW;
  if (pct <= 55) return RISK_MODERATE;
  if (pct <= 85) return RISK_HIGH;
  return SIGNAL_RED;
}

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

interface RiskGaugeProps {
  /** Risk score from 0 to 100. */
  value: number;
  /** Diameter in px. Default 200. */
  size?: number;
  className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function RiskGauge({ value, size = 200, className }: RiskGaugeProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const risk = getRiskLevel(clampedValue);

  // SVG geometry
  const strokeWidth = size * 0.08;
  const radius = (size - strokeWidth) / 2 - 8; // padding for needle overhang
  const cx = size / 2;
  const cy = size / 2 + size * 0.05; // shift center down slightly

  // Spring animation for the value
  const spring = useSpring(0, { stiffness: 60, damping: 20 });
  const animatedValue = useTransform(spring, (v: number) => v);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    spring.set(clampedValue);
    const unsub = animatedValue.on("change", (v: number) => setDisplayValue(Math.round(v)));
    return unsub;
  }, [clampedValue, spring, animatedValue]);

  // Needle angle: -180deg = 0%, 0deg = 100%
  const needleAngle = -180 + (displayValue / 100) * 180;

  // Build gradient arc using multiple small arc segments
  const numSegments = 60;
  const segmentArcs = [];
  for (let i = 0; i < numSegments; i++) {
    const pct = (i / numSegments) * 100;
    if (pct > clampedValue) break;
    const startAngle = Math.PI + (i / numSegments) * Math.PI;
    const endAngle = Math.PI + ((i + 1) / numSegments) * Math.PI;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);

    segmentArcs.push(
      <path
        key={i}
        d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`}
        stroke={arcColorAt(pct)}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="butt"
      />,
    );
  }

  // Background track arc (full semicircle)
  const trackStartX = cx + radius * Math.cos(Math.PI);
  const trackStartY = cy + radius * Math.sin(Math.PI);
  const trackEndX = cx + radius * Math.cos(0);
  const trackEndY = cy + radius * Math.sin(0);

  // Needle dimensions
  const needleLength = radius - 6;
  const needleBaseWidth = 4;

  return (
    <div
      className={cn("inline-flex flex-col items-center", className)}
      style={{ width: size }}
    >
      <svg
        width={size}
        height={size * 0.62}
        viewBox={`0 0 ${size} ${size * 0.62}`}
        className="overflow-visible"
      >
        {/* Background track */}
        <path
          d={`M ${trackStartX} ${trackStartY} A ${radius} ${radius} 0 0 1 ${trackEndX} ${trackEndY}`}
          stroke={GRAPHITE}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />

        {/* Colored fill segments */}
        {segmentArcs}

        {/* Tick marks at risk boundaries */}
        {[0, 25, 40, 55, 75, 85, 100].map((tick) => {
          const angle = Math.PI + (tick / 100) * Math.PI;
          const innerR = radius - strokeWidth / 2 - 3;
          const outerR = radius + strokeWidth / 2 + 3;
          return (
            <line
              key={tick}
              x1={cx + innerR * Math.cos(angle)}
              y1={cy + innerR * Math.sin(angle)}
              x2={cx + outerR * Math.cos(angle)}
              y2={cy + outerR * Math.sin(angle)}
              stroke={ASH}
              strokeWidth={1}
              opacity={0.5}
            />
          );
        })}

        {/* Needle */}
        <g
          style={{
            transform: `rotate(${needleAngle}deg)`,
            transformOrigin: `${cx}px ${cy}px`,
            transition: "transform 0.05s linear",
          }}
        >
          {/* Needle body — thin triangle */}
          <polygon
            points={`
              ${cx + needleLength},${cy}
              ${cx - 6},${cy - needleBaseWidth / 2}
              ${cx - 6},${cy + needleBaseWidth / 2}
            `}
            fill={BONE}
          />
          {/* Needle center dot */}
          <circle cx={cx} cy={cy} r={5} fill={BONE} />
          <circle cx={cx} cy={cy} r={2.5} fill={risk.color} />
        </g>
      </svg>

      {/* Value display */}
      <div className="mt-1 flex flex-col items-center gap-0.5">
        <motion.span
          className="font-semibold text-2xl tabular-nums"
          style={{ color: BONE }}
        >
          {displayValue}
        </motion.span>
        <span
          className="text-sm font-medium uppercase tracking-widest"
          style={{ color: risk.color }}
        >
          {risk.label}
        </span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Mock Data Helper
// ────────────────────────────────────────────────────────────────────────────

/** Generate a random risk score for testing. */
export function generateMockRiskScore(): number {
  // Weight toward more interesting values (medium-high)
  const raw = Math.random();
  return Math.round(raw * raw * 60 + Math.random() * 40);
}
