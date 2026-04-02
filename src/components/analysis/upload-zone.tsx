"use client";

/**
 * PROBATIO — Forensic Upload Zone
 *
 * Full-featured upload component that handles the entire analysis
 * lifecycle: file selection, client-side SHA-256 hashing, duplicate
 * checking, upload, and real-time pipeline progress tracking.
 *
 * State machine:
 * idle -> hashing -> checking -> ready -> uploading -> queued -> processing -> completed | failed
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn, formatFileSize } from "@/lib/utils";
import { SUPPORTED_FORMATS, MAX_FILE_SIZE, CREDIT_COSTS } from "@/lib/constants";
import { computeFileHash } from "@/lib/analysis/chain-of-custody";
import { useCreditStore } from "@/stores/credit-store";
import { useAnalysisStatus } from "@/hooks/use-analysis-status";
import { HashDisplay } from "./hash-display";
import { FileInfoCard } from "./file-info-card";
import { PipelineProgress } from "./pipeline-progress";
import { Button } from "@/components/ui";
import {
  Upload,
  FileAudio,
  Shield,
  CheckCircle,
  AlertTriangle,
  Loader2,
  X,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import type { AnalysisMode } from "@/types/database";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface UploadZoneProps {
  /** Analysis mode — affects credit cost and pipeline behavior. */
  mode?: "screening" | "forensic" | "clearance";
  /** Catalog IDs to scan against in clearance mode. */
  catalogIds?: string[];
  /** Called when an analysis row has been created on the server. */
  onAnalysisCreated?: (analysisId: string) => void;
  /** Additional CSS classes. */
  className?: string;
}

type UploadState =
  | "idle"
  | "hashing"
  | "checking"
  | "ready"
  | "uploading"
  | "queued"
  | "processing"
  | "completed"
  | "failed";

interface DuplicateInfo {
  analysisId: string;
  status: string;
  completedAt: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const ACCEPTED_EXTENSIONS = SUPPORTED_FORMATS.map((f) => `.${f}`).join(",");

function getAnalysisMode(mode: "screening" | "forensic" | "clearance"): AnalysisMode {
  if (mode === "forensic") return "forensic";
  if (mode === "clearance") return "clearance";
  return "screening";
}

function getFileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function validateFile(file: File): string | null {
  const ext = getFileExtension(file.name);
  if (!ext || !SUPPORTED_FORMATS.includes(ext as never)) {
    return `Unsupported format. Accepted: ${SUPPORTED_FORMATS.join(", ")}`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File too large. Maximum size: ${formatFileSize(MAX_FILE_SIZE)}`;
  }
  if (file.size === 0) {
    return "File is empty.";
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function UploadZone({
  mode = "screening",
  catalogIds,
  onAnalysisCreated,
  className,
}: UploadZoneProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Local state ──────────────────────────────────────────────────────────
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);

  // ── External stores and hooks ────────────────────────────────────────────
  const { balance, initialized, fetchCredits, checkBalance, getCost, deductCredits } =
    useCreditStore();
  const realtimeStatus = useAnalysisStatus(analysisId);

  const analysisMode = getAnalysisMode(mode);
  const creditCost = getCost(analysisMode);
  const hasCredits = checkBalance(analysisMode);

  // Fetch credits on mount if not yet loaded
  useEffect(() => {
    if (!initialized) {
      fetchCredits();
    }
  }, [initialized, fetchCredits]);

  // ── React to realtime status changes ─────────────────────────────────────
  useEffect(() => {
    if (!analysisId || !realtimeStatus.status) return;

    if (realtimeStatus.isProcessing && uploadState !== "processing") {
      setUploadState("processing");
    }

    if (realtimeStatus.isCompleted) {
      setUploadState("completed");
      toast.success("Analysis complete");
      // Navigate to the analysis detail page after a brief delay
      const timer = setTimeout(() => {
        router.push(`/dashboard/analyses/${analysisId}`);
      }, 1500);
      return () => clearTimeout(timer);
    }

    if (realtimeStatus.isFailed) {
      setUploadState("failed");
      setError(realtimeStatus.errorMessage ?? "Analysis failed unexpectedly.");
      toast.error("Analysis failed. Credit refunded.");
    }
  }, [
    analysisId,
    realtimeStatus.status,
    realtimeStatus.isCompleted,
    realtimeStatus.isFailed,
    realtimeStatus.isProcessing,
    realtimeStatus.errorMessage,
    uploadState,
    router,
  ]);

  // ── File selection ───────────────────────────────────────────────────────
  const handleFile = useCallback(
    async (selectedFile: File) => {
      // Reset state for new file
      setError(null);
      setDuplicate(null);
      setAnalysisId(null);

      // Validate
      const validationError = validateFile(selectedFile);
      if (validationError) {
        setError(validationError);
        return;
      }

      setFile(selectedFile);
      setUploadState("hashing");

      // Compute SHA-256 client-side
      try {
        const hash = await computeFileHash(selectedFile);
        setFileHash(hash);
        setUploadState("checking");

        // Check for duplicates
        try {
          const res = await fetch(
            `/api/analyze/check?hash=${encodeURIComponent(hash)}`,
          );

          if (res.ok) {
            const data = await res.json();

            if (data.exists) {
              setDuplicate({
                analysisId: data.analysisId,
                status: data.status,
                completedAt: data.completedAt ?? null,
              });
            }
          }
          // If the check endpoint errors, we proceed anyway — it's not critical
        } catch {
          // Network error on dedup check is non-fatal
        }

        setUploadState("ready");
      } catch (err) {
        setError(
          err instanceof Error
            ? `Hashing failed: ${err.message}`
            : "Failed to compute file hash.",
        );
        setUploadState("idle");
        setFile(null);
      }
    },
    [],
  );

  // ── Drag and drop handlers ───────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFile(droppedFile);
      }
    },
    [handleFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) {
        handleFile(selected);
      }
      // Reset the input so re-selecting the same file triggers onChange
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [handleFile],
  );

  // ── Upload ───────────────────────────────────────────────────────────────
  const handleUpload = useCallback(async () => {
    if (!file || !fileHash) return;

    if (!hasCredits) {
      toast.error("Insufficient credits. Upgrade your plan to continue.");
      return;
    }

    setError(null);
    setUploadState("uploading");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("client_hash", fileHash);
      formData.append("mode", analysisMode);
      if (analysisMode === "clearance" && catalogIds && catalogIds.length > 0) {
        formData.append("catalog_ids", JSON.stringify(catalogIds));
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(data.error || `Upload failed (${res.status})`);
      }

      const data = await res.json();
      const newAnalysisId = data.analysisId as string;

      setAnalysisId(newAnalysisId);
      setUploadState("queued");

      // Optimistically deduct credits
      deductCredits(analysisMode);

      // Notify parent
      onAnalysisCreated?.(newAnalysisId);

      toast.success("Upload complete. Analysis queued.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Upload failed unexpectedly.";
      setError(message);
      setUploadState("ready");
      toast.error(message);
    }
  }, [file, fileHash, hasCredits, analysisMode, deductCredits, onAnalysisCreated]);

  // ── Reset ────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setFile(null);
    setFileHash(null);
    setAnalysisId(null);
    setError(null);
    setDuplicate(null);
    setUploadState("idle");
  }, []);

  // ── Render helpers ───────────────────────────────────────────────────────
  const isIdle = uploadState === "idle";
  const isHashing = uploadState === "hashing";
  const isReady = uploadState === "ready" || uploadState === "checking";
  const isUploading = uploadState === "uploading";
  const isQueued = uploadState === "queued";
  const isProcessing = uploadState === "processing";
  const isCompleted = uploadState === "completed";
  const isFailed = uploadState === "failed";
  const isPipelineActive = isQueued || isProcessing;

  return (
    <div className={cn("w-full", className)}>
      {/* ── Idle: Drop Zone ─────────────────────────────────────────────── */}
      {isIdle && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          aria-label="Drop an audio file here or click to browse"
          className={cn(
            "flex flex-col items-center justify-center gap-5 p-12",
            "rounded-lg border-2 border-dashed cursor-pointer",
            "transition-all duration-micro ease-out-probatio",
            dragOver
              ? "border-forensic-blue bg-forensic-blue/5 shadow-glow-blue"
              : "border-slate hover:border-ash bg-carbon/50 hover:bg-carbon/70",
          )}
        >
          <div
            className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center transition-colors duration-micro",
              dragOver ? "bg-forensic-blue/15" : "bg-graphite",
            )}
          >
            <Upload
              size={22}
              className={cn(
                "transition-colors duration-micro",
                dragOver ? "text-forensic-blue" : "text-ash",
              )}
            />
          </div>

          <div className="text-center space-y-1.5">
            <p className="text-sm font-sans font-medium text-bone">
              Drop your audio file here, or{" "}
              <span className="text-forensic-blue">browse</span>
            </p>
            <p className="text-xs font-sans text-ash">
              {SUPPORTED_FORMATS.map((f) => f.toUpperCase()).join(", ")} up to{" "}
              {formatFileSize(MAX_FILE_SIZE, 0)}
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-ash/60">
            <Shield size={12} />
            <span className="font-sans">
              Files are hashed client-side for chain of custody
            </span>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            onChange={handleInputChange}
            className="hidden"
            aria-hidden="true"
          />
        </div>
      )}

      {/* ── Hashing: Computing hash ─────────────────────────────────────── */}
      {isHashing && file && (
        <div className="space-y-4">
          <FileInfoCard
            fileName={file.name}
            fileSize={file.size}
            fileType={file.type || getFileExtension(file.name)}
            hash={null}
            hashLoading
          />
        </div>
      )}

      {/* ── Ready: File selected, hash computed, waiting for user ────────── */}
      {isReady && file && (
        <div className="space-y-4">
          {/* File info */}
          <div className="relative">
            <button
              type="button"
              onClick={handleReset}
              className="absolute top-3 right-3 z-10 p-1 rounded text-ash hover:text-bone hover:bg-slate/40 transition-colors duration-micro"
              aria-label="Remove file"
            >
              <X size={16} />
            </button>
            <FileInfoCard
              fileName={file.name}
              fileSize={file.size}
              fileType={file.type || getFileExtension(file.name)}
              hash={fileHash}
              hashLoading={uploadState === "checking"}
            />
          </div>

          {/* Duplicate warning */}
          {duplicate && (
            <div className="flex items-start gap-3 p-3 rounded-md border border-evidence-gold/30 bg-evidence-gold/5">
              <AlertTriangle
                size={16}
                className="text-evidence-gold shrink-0 mt-0.5"
              />
              <div className="space-y-1 min-w-0 flex-1">
                {duplicate.status === "completed" ? (
                  <>
                    <p className="text-xs font-sans font-medium text-evidence-gold">
                      This file was already analyzed
                      {duplicate.completedAt &&
                        ` on ${new Date(duplicate.completedAt).toLocaleDateString()}`}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/dashboard/analyses/${duplicate.analysisId}`,
                        )
                      }
                      className="inline-flex items-center gap-1 text-xs font-sans text-forensic-blue hover:underline"
                    >
                      View results
                      <ExternalLink size={10} />
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-sans font-medium text-evidence-gold">
                      Analysis already in progress for this file
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/dashboard/analyses/${duplicate.analysisId}`,
                        )
                      }
                      className="inline-flex items-center gap-1 text-xs font-sans text-forensic-blue hover:underline"
                    >
                      View status
                      <ExternalLink size={10} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-3 rounded-md border border-signal-red/30 bg-signal-red/5">
              <AlertTriangle
                size={16}
                className="text-signal-red shrink-0 mt-0.5"
              />
              <p className="text-xs font-sans text-signal-red">{error}</p>
            </div>
          )}

          {/* Credit info + action */}
          <div className="space-y-3">
            {initialized && (
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-sans text-ash">
                  This will use{" "}
                  <span className="text-bone font-medium">
                    {creditCost} credit{creditCost !== 1 ? "s" : ""}
                  </span>
                </span>
                <span className="text-xs font-sans text-ash">
                  Balance:{" "}
                  <span
                    className={cn(
                      "font-medium",
                      hasCredits ? "text-bone" : "text-signal-red",
                    )}
                  >
                    {balance}
                  </span>
                </span>
              </div>
            )}

            {hasCredits ? (
              <Button
                onClick={handleUpload}
                fullWidth
                size="lg"
                disabled={!fileHash || uploadState === "checking"}
                loading={isUploading}
              >
                {isUploading ? (
                  "Uploading..."
                ) : (
                  <>
                    <Shield size={16} />
                    Analyze Track
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-2">
                <Button fullWidth size="lg" disabled variant="outline">
                  <AlertTriangle size={16} />
                  Insufficient Credits
                </Button>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/billing")}
                  className="w-full text-center text-xs font-sans text-forensic-blue hover:underline"
                >
                  Upgrade your plan to continue
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Uploading ───────────────────────────────────────────────────── */}
      {isUploading && file && (
        <div className="space-y-4">
          <FileInfoCard
            fileName={file.name}
            fileSize={file.size}
            fileType={file.type || getFileExtension(file.name)}
            hash={fileHash}
          />
          <div className="flex items-center justify-center gap-3 py-6">
            <Loader2 size={20} className="animate-spin text-forensic-blue" />
            <span className="text-sm font-sans text-bone">
              Uploading file...
            </span>
          </div>
        </div>
      )}

      {/* ── Pipeline Active (queued / processing) ───────────────────────── */}
      {isPipelineActive && file && (
        <div className="space-y-4">
          <FileInfoCard
            fileName={file.name}
            fileSize={file.size}
            fileType={file.type || getFileExtension(file.name)}
            hash={fileHash}
          />
          <PipelineProgress
            status={realtimeStatus.status ?? "pending"}
            progressPct={realtimeStatus.progressPct}
            currentStep={realtimeStatus.currentStep}
          />
        </div>
      )}

      {/* ── Completed ───────────────────────────────────────────────────── */}
      {isCompleted && file && (
        <div className="space-y-4">
          <FileInfoCard
            fileName={file.name}
            fileSize={file.size}
            fileType={file.type || getFileExtension(file.name)}
            hash={fileHash}
          />
          <PipelineProgress
            status="completed"
            progressPct={100}
            currentStep={null}
          />
          <div className="flex items-center justify-center gap-2 py-3">
            <CheckCircle size={16} className="text-risk-low" />
            <span className="text-sm font-sans text-risk-low font-medium">
              Redirecting to results...
            </span>
          </div>
        </div>
      )}

      {/* ── Failed ──────────────────────────────────────────────────────── */}
      {isFailed && file && (
        <div className="space-y-4">
          <FileInfoCard
            fileName={file.name}
            fileSize={file.size}
            fileType={file.type || getFileExtension(file.name)}
            hash={fileHash}
          />
          <PipelineProgress
            status="failed"
            progressPct={realtimeStatus.progressPct}
            currentStep={realtimeStatus.currentStep}
          />
          {error && (
            <div className="flex items-start gap-3 p-3 rounded-md border border-signal-red/30 bg-signal-red/5">
              <AlertTriangle
                size={16}
                className="text-signal-red shrink-0 mt-0.5"
              />
              <p className="text-xs font-sans text-signal-red">{error}</p>
            </div>
          )}
          <div className="flex gap-3">
            <Button
              onClick={handleReset}
              variant="outline"
              fullWidth
            >
              Try Another File
            </Button>
            <Button
              onClick={handleUpload}
              fullWidth
            >
              Retry
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
