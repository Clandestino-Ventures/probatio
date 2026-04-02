"use client";

/**
 * PROBATIO — Hero Section
 *
 * Full-viewport landing hero with animated spectrogram canvas background,
 * wordmark, tagline, CTA, and scroll hint. Framer Motion fade-in choreography.
 */

import { useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Spectrogram Background
// ────────────────────────────────────────────────────────────────────────────

const BAR_COUNT = 120;
const FORENSIC_BLUE_R = 46;
const FORENSIC_BLUE_G = 108;
const FORENSIC_BLUE_B = 230;

function SpectrogramCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const barsRef = useRef<{ height: number; phase: number; speed: number }[]>(
    [],
  );

  const initBars = useCallback(() => {
    barsRef.current = Array.from({ length: BAR_COUNT }, () => ({
      height: Math.random() * 0.6 + 0.1,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.003 + 0.001,
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    initBars();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    let time = 0;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      // Clear with obsidian
      ctx.fillStyle = "#0A0A0B";
      ctx.fillRect(0, 0, w, h);

      const barWidth = w / BAR_COUNT;
      const bars = barsRef.current;

      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i];
        // Breathing animation — slow sine modulation
        const breathe = Math.sin(time * bar.speed * 60 + bar.phase);
        const amplitude = bar.height * (0.7 + 0.3 * breathe);
        const barH = amplitude * h * 0.7;

        // Opacity varies by position and time for grain effect
        const baseOpacity = 0.08 + 0.18 * amplitude;
        const grain = 0.97 + 0.03 * Math.sin(time * 0.02 + i * 0.5);
        const opacity = baseOpacity * grain;

        const x = i * barWidth;
        const y = (h - barH) / 2;

        ctx.fillStyle = `rgba(${FORENSIC_BLUE_R}, ${FORENSIC_BLUE_G}, ${FORENSIC_BLUE_B}, ${opacity})`;
        ctx.fillRect(x, y, barWidth - 1, barH);
      }

      time++;
      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frameRef.current);
    };
  }, [initBars]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("absolute inset-0 h-full w-full", className)}
      aria-hidden="true"
    />
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Animation Variants
// ────────────────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      delay,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  }),
};

const bounceDown = {
  animate: {
    y: [0, 6, 0],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Hero Component
// ────────────────────────────────────────────────────────────────────────────

export function Hero() {
  const t = useTranslations('landing.hero');

  return (
    <section className="relative flex h-dvh min-h-150 flex-col items-center justify-center overflow-hidden bg-obsidian">
      {/* Spectrogram background */}
      <SpectrogramCanvas />

      {/* Gradient overlay for depth */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, #0A0A0B 75%)",
        }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        {/* Wordmark */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          <span
            className="font-display text-sm uppercase text-ash/60 md:text-base"
            style={{ letterSpacing: '0.2em' }}
          >
            PROBATIO
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          className="mt-6 font-display text-3xl text-bone md:text-5xl lg:text-6xl"
          style={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.15}
        >
          {t('headline').split('\n').map((line: string, i: number) => (
            <span key={i}>
              {line}
              {i === 0 && <br />}
            </span>
          ))}
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="mt-6 max-w-xl font-sans text-base text-ash md:text-lg"
          style={{ lineHeight: 1.6 }}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.3}
        >
          {t('subheadline').split('\n').map((line: string, i: number) => (
            <span key={i}>
              {line}
              {i === 0 && <br />}
            </span>
          ))}
        </motion.p>

        {/* CTAs */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.45}
          className="mt-10 flex items-center gap-4"
        >
          <Link
            href="/signup"
            className={cn(
              "inline-flex items-center justify-center",
              "rounded-md bg-evidence-gold px-8 py-3",
              "font-sans text-sm font-medium text-obsidian",
              "transition-all duration-200",
              "hover:bg-evidence-gold/85",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-evidence-gold focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian",
            )}
          >
            {t('cta')}
          </Link>
          <Link
            href="/methodology"
            className={cn(
              "inline-flex items-center justify-center",
              "rounded-md border border-slate px-6 py-3",
              "font-sans text-sm font-medium text-ash",
              "transition-all duration-200",
              "hover:border-ash hover:text-bone",
            )}
          >
            {t('ctaSecondary')}
          </Link>
        </motion.div>

        {/* Trust bar */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.6}
          className="mt-10"
        >
          <p className="font-mono text-xs text-bone/60" style={{ letterSpacing: '0.05em' }}>
            {t('socialProof')}
          </p>
        </motion.div>
      </div>

      {/* Scroll hint */}
      <motion.div
        className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
      >
        <motion.div {...bounceDown}>
          <ChevronDown className="h-5 w-5 text-ash/40" />
        </motion.div>
      </motion.div>
    </section>
  );
}
