"use client";

/**
 * PROBATIO — File Upload Component
 *
 * Drag-and-drop upload zone for audio files. Computes SHA-256 hash
 * client-side. Shows file info, progress bar, and validation errors.
 *
 * Supported formats: WAV, MP3, FLAC, AIFF
 * Max file size: 50 MB
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileAudio, X, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/utils";
import { Progress } from "./progress";

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = [
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/flac",
  "audio/x-flac",
  "audio/aiff",
  "audio/x-aiff",
] as const;

const ACCEPTED_EXTENSIONS = [".wav", ".mp3", ".flac", ".aiff", ".aif"] as const;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface FileUploadResult {
  file: File;
  sha256: string;
}

export interface FileUploadProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onDrop" | "onError"> {
  /** Callback when a file is selected and hashed. */
  onFileSelect?: (result: FileUploadResult) => void;
  /** Callback on validation or processing error. */
  onError?: (error: string) => void;
  /** External upload progress (0-100). */
  uploadProgress?: number;
  /** Whether an upload is currently in progress. */
  uploading?: boolean;
  /** Disable the upload zone. */
  disabled?: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────────────────

function isAcceptedFile(file: File): boolean {
  const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
  if (ACCEPTED_EXTENSIONS.includes(ext as (typeof ACCEPTED_EXTENSIONS)[number])) return true;
  if (ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number])) return true;
  return false;
}

async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

const FileUpload = React.forwardRef<HTMLDivElement, FileUploadProps>(
  (
    {
      className,
      onFileSelect,
      onError,
      uploadProgress,
      uploading = false,
      disabled = false,
      ...props
    },
    ref,
  ) => {
    const [dragActive, setDragActive] = React.useState(false);
    const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
    const [sha256, setSha256] = React.useState<string | null>(null);
    const [hashing, setHashing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const isDisabled = disabled || uploading || hashing;

    const resetState = () => {
      setSelectedFile(null);
      setSha256(null);
      setError(null);
      setHashing(false);
      if (inputRef.current) inputRef.current.value = "";
    };

    const processFile = React.useCallback(
      async (file: File) => {
        setError(null);
        setSha256(null);

        // Validate type
        if (!isAcceptedFile(file)) {
          const msg = "Unsupported format. Please use WAV, MP3, FLAC, or AIFF.";
          setError(msg);
          onError?.(msg);
          return;
        }

        // Validate size
        if (file.size > MAX_FILE_SIZE) {
          const msg = `File too large (${formatFileSize(file.size)}). Maximum is 50 MB.`;
          setError(msg);
          onError?.(msg);
          return;
        }

        setSelectedFile(file);
        setHashing(true);

        try {
          const hash = await computeSHA256(file);
          setSha256(hash);

          // Validate audio duration
          try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
            const durationSeconds = audioBuffer.duration;
            audioContext.close();

            if (durationSeconds < 5) {
              const msg = 'Audio must be at least 5 seconds long.';
              setError(msg);
              onError?.(msg);
              setSelectedFile(null);
              setSha256(null);
              return;
            }
            if (durationSeconds > 15 * 60) {
              const msg = 'Audio must be under 15 minutes.';
              setError(msg);
              onError?.(msg);
              setSelectedFile(null);
              setSha256(null);
              return;
            }
          } catch {
            // If Web Audio API can't decode, let the server validate
          }

          onFileSelect?.({ file, sha256: hash });
        } catch {
          const msg = "Failed to compute file hash. Please try again.";
          setError(msg);
          onError?.(msg);
        } finally {
          setHashing(false);
        }
      },
      [onFileSelect, onError],
    );

    // ── Drag handlers ─────────────────────────────────────────────────────

    const handleDragEnter = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isDisabled) setDragActive(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Only deactivate if leaving the container (not entering a child)
      if (e.currentTarget === e.target) {
        setDragActive(false);
      }
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (isDisabled) return;

      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    };

    const handleClick = () => {
      if (!isDisabled) inputRef.current?.click();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && !isDisabled) {
        e.preventDefault();
        inputRef.current?.click();
      }
    };

    // ── Render ────────────────────────────────────────────────────────────

    return (
      <div ref={ref} className={cn("w-full", className)} {...props}>
        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          onChange={handleInputChange}
          className="sr-only"
          aria-label="Upload audio file"
          tabIndex={-1}
        />

        {/* Drop zone */}
        <motion.div
          role="button"
          tabIndex={isDisabled ? -1 : 0}
          aria-label="Upload audio file. Drag and drop or click to select."
          aria-disabled={isDisabled}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          animate={{
            borderColor: dragActive
              ? "rgb(46, 108, 230)"
              : error
                ? "rgb(230, 57, 38)"
                : "rgb(58, 58, 63)",
          }}
          transition={{ duration: 0.15 }}
          className={cn(
            "relative flex flex-col items-center justify-center gap-3",
            "rounded-md border-2 border-dashed p-8",
            "bg-carbon/50",
            "transition-colors duration-micro cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forensic-blue focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian",
            dragActive && "bg-forensic-blue/5 border-forensic-blue",
            error && "border-signal-red",
            isDisabled && "opacity-50 cursor-not-allowed",
          )}
        >
          <AnimatePresence mode="wait">
            {!selectedFile ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex flex-col items-center gap-3 text-center"
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-full",
                    "bg-slate/20",
                    dragActive && "bg-forensic-blue/20",
                  )}
                >
                  <Upload
                    size={24}
                    className={cn(
                      "text-ash",
                      dragActive && "text-forensic-blue",
                    )}
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <p className="text-sm font-sans font-medium text-bone">
                    {dragActive ? "Drop your audio file" : "Drag & drop an audio file"}
                  </p>
                  <p className="text-xs text-ash mt-1">
                    or click to browse &middot; WAV, MP3, FLAC, AIFF &middot; Max 50 MB
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="file-info"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex flex-col items-center gap-3 w-full max-w-md"
              >
                {/* File info */}
                <div className="flex items-center gap-3 w-full">
                  <div className="flex items-center justify-center w-10 h-10 rounded-md bg-forensic-blue/10">
                    <FileAudio size={20} className="text-forensic-blue" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-sans font-medium text-bone truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-ash">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                  {!uploading && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        resetState();
                      }}
                      className={cn(
                        "p-1 rounded-sm text-ash hover:text-bone hover:bg-slate/30",
                        "transition-colors duration-micro",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forensic-blue",
                      )}
                      aria-label="Remove selected file"
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>

                {/* SHA-256 hash */}
                {hashing && (
                  <div className="flex items-center gap-2 w-full">
                    <div className="w-3 h-3 rounded-full border-2 border-forensic-blue border-t-transparent animate-spin" />
                    <span className="text-xs text-ash font-sans">Computing SHA-256 hash...</span>
                  </div>
                )}

                {sha256 && (
                  <div className="w-full rounded-sm bg-graphite px-3 py-2 flex items-center gap-2">
                    <CheckCircle2 size={14} className="shrink-0 text-risk-low" aria-hidden="true" />
                    <span className="text-xs font-mono text-bone/70 truncate" title={sha256}>
                      SHA-256: {sha256}
                    </span>
                  </div>
                )}

                {/* Upload progress */}
                {uploading && typeof uploadProgress === "number" && (
                  <Progress
                    value={uploadProgress}
                    size="sm"
                    color="blue"
                    label="Uploading..."
                    showPercentage
                    className="w-full"
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-1.5 mt-2"
              role="alert"
            >
              <AlertCircle size={14} className="shrink-0 text-signal-red" aria-hidden="true" />
              <p className="text-xs text-signal-red font-sans">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

FileUpload.displayName = "FileUpload";

export { FileUpload };
