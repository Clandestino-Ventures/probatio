"use client";

import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

type SealStatus = "verified" | "sealed" | "pending";

interface SealProps {
  status: SealStatus;
  size?: number;
  className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Status → color mapping
// ────────────────────────────────────────────────────────────────────────────

const statusColors: Record<SealStatus, string> = {
  verified: "#C4992E", // Evidence Gold
  sealed: "#C4992E",   // Evidence Gold
  pending: "#8A8A8E",  // Ash
};

const statusBottomLabel: Record<SealStatus, string> = {
  verified: "VERIFIED",
  sealed: "SEALED",
  pending: "PENDING",
};

// ────────────────────────────────────────────────────────────────────────────
// Seal Component
// ────────────────────────────────────────────────────────────────────────────

export function Seal({ status, size = 64, className }: SealProps) {
  const color = statusColors[status];
  const bottomLabel = statusBottomLabel[status];

  // All coordinates are based on a 100-unit viewBox, scaled by `size`.
  const cx = 50;
  const cy = 50;

  // Ring radii
  const outerR = 46;
  const innerR = 40;

  // Text path radii — positioned between the two rings
  const textR = 35;

  // Waveform in center
  const waveY = 50;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      role="img"
      aria-label={`Chain of custody seal: ${status}`}
    >
      <defs>
        {/* Top arc path for "PROBATIO" */}
        <path
          id={`seal-arc-top-${status}`}
          d={`M ${cx - textR} ${cy} A ${textR} ${textR} 0 1 1 ${cx + textR} ${cy}`}
          fill="none"
        />
        {/* Bottom arc path for status label */}
        <path
          id={`seal-arc-bottom-${status}`}
          d={`M ${cx + textR} ${cy} A ${textR} ${textR} 0 1 1 ${cx - textR} ${cy}`}
          fill="none"
        />
      </defs>

      {/* Double ring border */}
      <circle
        cx={cx}
        cy={cy}
        r={outerR}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
      />
      <circle
        cx={cx}
        cy={cy}
        r={innerR}
        stroke={color}
        strokeWidth={1}
        fill="none"
      />

      {/* "PROBATIO" text along top arc */}
      <text
        fill={color}
        fontSize={9}
        fontFamily="'Instrument Serif', 'Playfair Display', Georgia, serif"
        letterSpacing="0.15em"
      >
        <textPath
          href={`#seal-arc-top-${status}`}
          startOffset="50%"
          textAnchor="middle"
        >
          PROBATIO
        </textPath>
      </text>

      {/* Status text along bottom arc */}
      <text
        fill={color}
        fontSize={7}
        fontFamily="'Geist', -apple-system, sans-serif"
        letterSpacing="0.12em"
      >
        <textPath
          href={`#seal-arc-bottom-${status}`}
          startOffset="50%"
          textAnchor="middle"
        >
          {bottomLabel}
        </textPath>
      </text>

      {/* Center waveform icon */}
      <path
        d={[
          `M 35 ${waveY}`,
          `L 39 ${waveY}`,
          `L 41 ${waveY - 8}`,
          `L 44 ${waveY + 6}`,
          `L 47 ${waveY - 10}`,
          `L 50 ${waveY + 8}`,
          `L 53 ${waveY - 6}`,
          `L 56 ${waveY + 10}`,
          `L 59 ${waveY - 4}`,
          `L 61 ${waveY}`,
          `L 65 ${waveY}`,
        ].join(" ")}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Small decorative dots at 3 o'clock and 9 o'clock */}
      <circle cx={cx - textR - 3} cy={cy} r={1} fill={color} />
      <circle cx={cx + textR + 3} cy={cy} r={1} fill={color} />

      {/* Checkmark overlay for "sealed" status */}
      {status === "sealed" && (
        <g transform={`translate(${cx + 14}, ${cy + 14})`}>
          <circle cx={0} cy={0} r={8} fill={color} />
          <path
            d="M -3.5 0.5 L -1 3 L 4 -2.5"
            stroke="#0A0A0B"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
      )}
    </svg>
  );
}
