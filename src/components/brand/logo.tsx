"use client";

import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface LogoProps {
  variant: "wordmark" | "monogram";
  size?: "sm" | "md" | "lg";
  className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Size Mappings
// ────────────────────────────────────────────────────────────────────────────

const wordmarkSizeClasses: Record<NonNullable<LogoProps["size"]>, string> = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl",
};

const monogramSizes: Record<NonNullable<LogoProps["size"]>, number> = {
  sm: 24,
  md: 32,
  lg: 48,
};

// ────────────────────────────────────────────────────────────────────────────
// Wordmark
// ────────────────────────────────────────────────────────────────────────────

function Wordmark({
  size = "md",
  className,
}: Omit<LogoProps, "variant">) {
  return (
    <span
      className={cn(
        "font-display tracking-wide uppercase text-bone select-none",
        wordmarkSizeClasses[size],
        className,
      )}
      aria-label="Probatio"
    >
      PROBATIO
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Monogram
// ────────────────────────────────────────────────────────────────────────────

function Monogram({
  size = "md",
  className,
}: Omit<LogoProps, "variant">) {
  const px = monogramSizes[size];
  const half = px / 2;
  const radius = half - 1.5; // Inset for stroke width

  // Waveform path runs horizontally through the center
  const waveAmplitude = px * 0.1;
  const waveStart = px * 0.15;
  const waveEnd = px * 0.85;
  const waveMid1 = px * 0.35;
  const waveMid2 = px * 0.5;
  const waveMid3 = px * 0.65;

  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${px} ${px}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-bone", className)}
      role="img"
      aria-label="Probatio monogram"
    >
      {/* Outer circle */}
      <circle
        cx={half}
        cy={half}
        r={radius}
        stroke="currentColor"
        strokeWidth={px > 30 ? 1.5 : 1}
        fill="none"
      />

      {/* Waveform line through center */}
      <path
        d={`M ${waveStart} ${half} Q ${waveMid1} ${half - waveAmplitude}, ${waveMid2} ${half} Q ${waveMid3} ${half + waveAmplitude}, ${waveEnd} ${half}`}
        stroke="currentColor"
        strokeWidth={px > 30 ? 1 : 0.75}
        strokeLinecap="round"
        fill="none"
        opacity={0.4}
      />

      {/* Letter S */}
      <text
        x={half}
        y={half}
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        fontSize={px * 0.45}
        fontFamily="'Instrument Serif', 'Playfair Display', Georgia, serif"
        letterSpacing="0.02em"
      >
        S
      </text>
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Logo (exported)
// ────────────────────────────────────────────────────────────────────────────

export function Logo({ variant, size = "md", className }: LogoProps) {
  if (variant === "wordmark") {
    return <Wordmark size={size} className={className} />;
  }

  return <Monogram size={size} className={className} />;
}
