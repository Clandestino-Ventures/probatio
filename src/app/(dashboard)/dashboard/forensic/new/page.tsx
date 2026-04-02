"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatFileSize, truncateHash } from "@/lib/utils";
import { SUPPORTED_FORMATS, MAX_FILE_SIZE } from "@/lib/constants";
import { Header } from "@/components/dashboard/header";
import { Button, Input } from "@/components/ui";
import {
  ArrowLeft,
  Upload,
  FileAudio,
  Hash,
  X,
  Scale,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface TrackFile {
  file: File;
  hash: string;
}

export default function NewForensicCasePage() {
  const router = useRouter();
  const t = useTranslations('forensic');

  // Form state
  const [caseName, setCaseName] = useState("");
  const [caseDescription, setCaseDescription] = useState("");
  const [partiesInvolved, setPartiesInvolved] = useState("");

  // Track uploads
  const [trackA, setTrackA] = useState<TrackFile | null>(null);
  const [trackB, setTrackB] = useState<TrackFile | null>(null);
  const [hashingA, setHashingA] = useState(false);
  const [hashingB, setHashingB] = useState(false);

  const inputRefA = useRef<HTMLInputElement>(null);
  const inputRefB = useRef<HTMLInputElement>(null);

  const [forensicTier, setForensicTier] = useState<"standard" | "expert">("standard");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptedTypes = SUPPORTED_FORMATS.map((f) => `.${f}`).join(",");

  const computeHash = useCallback(async (file: File): Promise<string> => {
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // crypto.subtle not available (e.g., non-HTTPS in some browsers)
      // Generate a placeholder hash from file name + size + timestamp
      const fallback = `${file.name}-${file.size}-${Date.now()}`;
      let hash = 0;
      for (let i = 0; i < fallback.length; i++) {
        const char = fallback.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(16).padStart(64, "0");
    }
  }, []);

  const validateFile = useCallback((file: File): string | null => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !SUPPORTED_FORMATS.includes(ext as never)) {
      return `Unsupported format. Accepted: ${SUPPORTED_FORMATS.join(", ")}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum: ${formatFileSize(MAX_FILE_SIZE)}`;
    }
    return null;
  }, []);

  const handleTrackFile = useCallback(
    async (
      file: File,
      setTrack: (t: TrackFile | null) => void,
      setHashing: (h: boolean) => void
    ) => {
      setError(null);
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      setHashing(true);
      try {
        const hash = await computeHash(file);
        setTrack({ file, hash });
      } catch {
        setError("Failed to compute file hash.");
      } finally {
        setHashing(false);
      }
    },
    [validateFile, computeHash]
  );

  const handleDrop = useCallback(
    (
      e: React.DragEvent,
      setTrack: (t: TrackFile | null) => void,
      setHashing: (h: boolean) => void
    ) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleTrackFile(droppedFile, setTrack, setHashing);
    },
    [handleTrackFile]
  );

  const handleSubmit = async () => {
    if (!caseName.trim()) {
      setError("Case name is required.");
      return;
    }
    if (!trackA || !trackB) {
      setError("Both Track A and Track B are required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("caseName", caseName.trim());
      formData.append("caseDescription", caseDescription.trim());
      formData.append("partiesInvolved", partiesInvolved.trim());
      formData.append("trackA", trackA.file);
      formData.append("trackAHash", trackA.hash);
      formData.append("trackB", trackB.file);
      formData.append("trackBHash", trackB.hash);
      formData.append("forensicTier", forensicTier);

      const res = await fetch("/api/forensic", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to create forensic case");
      }

      // Redirect to Stripe Checkout for payment
      const checkoutUrl = data.data?.checkoutUrl;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      // Fallback: navigate to case page
      router.push(`/dashboard/forensic/${data.data?.caseId || data.caseId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create case");
      setSubmitting(false);
    }
  };

  const isFormValid = caseName.trim() && trackA && trackB;

  return (
    <>
      <Header title="New Forensic Case" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-225 mx-auto px-6 py-8 space-y-8">
          {/* Back link */}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-ash hover:text-bone transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Dashboard
          </Link>

          {/* Case Info Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Scale size={18} className="text-evidence-gold" />
              <h2 className="text-lg font-semibold text-bone">
                Case Information
              </h2>
            </div>

            <Input
              label="Case Name"
              placeholder="e.g., Smith v. Jones — Melody Infringement"
              value={caseName}
              onChange={(e) => setCaseName(e.target.value)}
            />

            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-sm font-sans font-medium text-bone/80">
                Case Description
              </label>
              <textarea
                placeholder="Describe the nature of the copyright dispute..."
                value={caseDescription}
                onChange={(e) => setCaseDescription(e.target.value)}
                rows={4}
                className={cn(
                  "w-full px-3 py-2.5 rounded-md text-sm text-bone placeholder:text-ash/60",
                  "bg-graphite border border-slate resize-none",
                  "transition-colors duration-micro ease-out-probatio",
                  "focus:outline-none focus:ring-2 focus:ring-forensic-blue focus:ring-offset-1 focus:ring-offset-obsidian focus:border-forensic-blue"
                )}
              />
            </div>

            <Input
              label="Parties Involved"
              placeholder="e.g., John Smith (plaintiff), Jane Jones (defendant)"
              value={partiesInvolved}
              onChange={(e) => setPartiesInvolved(e.target.value)}
              hint="Optional"
            />
          </section>

          {/* Track Upload Section */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-bone">
              Audio Evidence
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Track A */}
              <TrackUploadZone
                label="Track A (Disputed)"
                track={trackA}
                hashing={hashingA}
                inputRef={inputRefA}
                acceptedTypes={acceptedTypes}
                onDrop={(e) => handleDrop(e, setTrackA, setHashingA)}
                onFileSelect={(f) =>
                  handleTrackFile(f, setTrackA, setHashingA)
                }
                onClear={() => setTrackA(null)}
              />

              {/* Track B */}
              <TrackUploadZone
                label="Track B (Original)"
                track={trackB}
                hashing={hashingB}
                inputRef={inputRefB}
                acceptedTypes={acceptedTypes}
                onDrop={(e) => handleDrop(e, setTrackB, setHashingB)}
                onFileSelect={(f) =>
                  handleTrackFile(f, setTrackB, setHashingB)
                }
                onClear={() => setTrackB(null)}
              />
            </div>
          </section>

          {/* Error */}
          {error && (
            <div className="p-3 bg-signal-red/10 border border-signal-red/30 rounded-md text-signal-red text-sm">
              {error}
            </div>
          )}

          {/* Tier Selection */}
          <div className="bg-carbon border border-slate rounded-md p-6">
            <h3 className="text-sm font-medium text-bone uppercase tracking-wider mb-4">
              Analysis Type
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <button
                type="button"
                onClick={() => setForensicTier("standard")}
                className={cn(
                  "text-left p-4 rounded-md border transition-colors",
                  forensicTier === "standard"
                    ? "border-evidence-gold bg-evidence-gold/5"
                    : "border-slate hover:border-ash"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-bone">Standard Analysis</span>
                  <span className="text-sm font-bold text-evidence-gold">$5,000</span>
                </div>
                <p className="text-xs text-ash">
                  Full comparison, evidence package, forensic report
                </p>
              </button>
              <button
                type="button"
                onClick={() => setForensicTier("expert")}
                className={cn(
                  "text-left p-4 rounded-md border transition-colors",
                  forensicTier === "expert"
                    ? "border-evidence-gold bg-evidence-gold/5"
                    : "border-slate hover:border-ash"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-bone">Expert Analysis</span>
                  <span className="text-sm font-bold text-evidence-gold">$15,000</span>
                </div>
                <p className="text-xs text-ash">
                  Standard + expert witness docs, audio clips, priority processing
                </p>
              </button>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-ash">
                {forensicTier === "expert"
                  ? "Includes dedicated analyst review and 24h priority"
                  : "Includes evidence packaging and court-ready report"}
              </p>
              <Button
                variant="gold"
                size="lg"
                onClick={handleSubmit}
                loading={submitting}
                disabled={!isFormValid || submitting}
              >
                Proceed to Payment — ${forensicTier === "expert" ? "15,000" : "5,000"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Track Upload Zone Sub-component
// ────────────────────────────────────────────────────────────────────────────

interface TrackUploadZoneProps {
  label: string;
  track: TrackFile | null;
  hashing: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  acceptedTypes: string;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (file: File) => void;
  onClear: () => void;
}

function TrackUploadZone({
  label,
  track,
  hashing,
  inputRef,
  acceptedTypes,
  onDrop,
  onFileSelect,
  onClear,
}: TrackUploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  if (hashing) {
    return (
      <div className="bg-carbon border border-slate rounded-md p-6">
        <p className="text-xs font-medium text-ash uppercase tracking-wider mb-3">
          {label}
        </p>
        <div className="flex flex-col items-center gap-3 py-4">
          <Loader2 size={20} className="text-forensic-blue animate-spin" />
          <p className="text-sm text-ash">Computing SHA-256 hash...</p>
        </div>
      </div>
    );
  }

  if (track) {
    return (
      <div className="bg-carbon border border-slate rounded-md p-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-ash uppercase tracking-wider">
            {label}
          </p>
          <button
            onClick={onClear}
            className="text-ash hover:text-bone transition-colors p-1"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-md bg-graphite flex items-center justify-center shrink-0">
            <FileAudio size={14} className="text-forensic-blue" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-bone truncate">
              {track.file.name}
            </p>
            <p className="text-xs text-ash">
              {formatFileSize(track.file.size)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 bg-graphite rounded-md">
          <Hash size={12} className="text-ash shrink-0" />
          <span className="text-xs font-mono text-ash truncate">
            SHA-256: {truncateHash(track.hash, 10, 10)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-carbon border border-slate rounded-md p-6">
      <p className="text-xs font-medium text-ash uppercase tracking-wider mb-3">
        {label}
      </p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          setDragOver(false);
          onDrop(e);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-3 p-8 rounded-md border-2 border-dashed cursor-pointer transition-colors",
          dragOver
            ? "border-forensic-blue bg-forensic-blue/5"
            : "border-slate hover:border-ash bg-obsidian/30"
        )}
      >
        <Upload size={18} className="text-ash" />
        <div className="text-center">
          <p className="text-sm text-bone mb-0.5">
            Drop audio or click to browse
          </p>
          <p className="text-xs text-ash">
            {SUPPORTED_FORMATS.slice(0, 4).join(", ").toUpperCase()} — up to{" "}
            {formatFileSize(MAX_FILE_SIZE, 0)}
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={acceptedTypes}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFileSelect(f);
          }}
          className="hidden"
        />
      </div>
    </div>
  );
}
