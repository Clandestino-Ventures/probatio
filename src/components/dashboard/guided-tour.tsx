"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui";

interface TourStep {
  target: string;
  title: string;
  description: string;
  placement: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "[data-tour='upload-zone']",
    title: "Upload Your First Track",
    description:
      "Drag any audio file here to start an analysis. Supports MP3, WAV, FLAC, and more.",
    placement: "bottom",
  },
  {
    target: "[data-tour='mode-selector']",
    title: "Choose Your Mode",
    description:
      "Screening for quick checks. Clearance for pre-release catalog scanning. Forensic for litigation-grade evidence.",
    placement: "bottom",
  },
  {
    target: "[data-tour='nav-catalogs']",
    title: "Your Reference Catalogs",
    description:
      "Upload your catalog to enable pre-release clearance scanning against your entire library.",
    placement: "right",
  },
  {
    target: "[data-tour='nav-organization']",
    title: "Manage Your Team",
    description:
      "Invite your A&R managers and legal team. Assign roles and manage access.",
    placement: "right",
  },
  {
    target: "[data-tour='credits']",
    title: "Credits & Usage",
    description:
      "Each analysis uses credits. Your Enterprise plan includes 9,999 credits per month.",
    placement: "bottom",
  },
  {
    target: "[data-tour='nav-forensic']",
    title: "Forensic Cases",
    description:
      "Create forensic cases for litigation. Every analysis produces court-ready evidence with chain of custody.",
    placement: "right",
  },
];

interface GuidedTourProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function GuidedTour({ onComplete, onSkip }: GuidedTourProps) {
  const [step, setStep] = useState(0);
  const [tooltipPos, setTooltipPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const currentStep = TOUR_STEPS[step];

  const updatePosition = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector(currentStep.target);
    if (!el) {
      // Element not found — skip to next
      if (step < TOUR_STEPS.length - 1) {
        setStep((s) => s + 1);
      } else {
        onComplete();
      }
      return;
    }

    const rect = el.getBoundingClientRect();
    let top = 0;
    let left = 0;

    switch (currentStep.placement) {
      case "bottom":
        top = rect.bottom + 12;
        left = rect.left + rect.width / 2 - 160;
        break;
      case "top":
        top = rect.top - 12 - 140;
        left = rect.left + rect.width / 2 - 160;
        break;
      case "right":
        top = rect.top + rect.height / 2 - 50;
        left = rect.right + 12;
        break;
      case "left":
        top = rect.top + rect.height / 2 - 50;
        left = rect.left - 12 - 320;
        break;
    }

    // Clamp to viewport
    top = Math.max(8, Math.min(window.innerHeight - 200, top));
    left = Math.max(8, Math.min(window.innerWidth - 340, left));

    setTooltipPos({ top, left });
  }, [currentStep, step, onComplete]);

  useEffect(() => {
    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [updatePosition]);

  const handleNext = () => {
    if (step < TOUR_STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  if (!currentStep || !tooltipPos) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[100] bg-black/50 pointer-events-none" />

      {/* Tooltip */}
      <div
        className="fixed z-[101] w-[320px] bg-carbon border border-evidence-gold/40 rounded-lg shadow-xl p-4"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
      >
        <div className="flex items-start justify-between mb-2">
          <h4 className="text-sm font-semibold text-bone">
            {currentStep.title}
          </h4>
          <button
            onClick={onSkip}
            className="text-ash hover:text-bone p-0.5"
          >
            <X size={14} />
          </button>
        </div>
        <p className="text-xs text-ash leading-relaxed mb-3">
          {currentStep.description}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-ash">
            {step + 1} / {TOUR_STEPS.length}
          </span>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={handlePrev}>
                <ChevronLeft size={14} />
              </Button>
            )}
            <Button size="sm" onClick={handleNext}>
              {step === TOUR_STEPS.length - 1 ? "Done" : "Next"}
              {step < TOUR_STEPS.length - 1 && (
                <ChevronRight size={14} />
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
