"use client";

/**
 * PROBATIO — File Info Card
 *
 * Displays audio file metadata after selection but before upload.
 * Shows file name, size, type badge, and the client-computed SHA-256
 * hash (or a loading spinner while the hash is being computed).
 */

import { cn, formatFileSize } from "@/lib/utils";
import { FileAudio, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui";
import { HashDisplay } from "./hash-display";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface FileInfoCardProps {
  /** Original file name. */
  fileName: string;
  /** File size in bytes. */
  fileSize: number;
  /** MIME type or file extension (e.g. "audio/wav", "wav"). */
  fileType: string;
  /** Hex-encoded SHA-256 hash, or null if not yet computed. */
  hash: string | null;
  /** Whether the hash is currently being computed. */
  hashLoading?: boolean;
  /** Additional CSS classes. */
  className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Extract a short display label from a MIME type or extension. */
function formatType(raw: string): string {
  // "audio/wav" → "WAV", "audio/mpeg" → "MPEG", "flac" → "FLAC"
  const parts = raw.split("/");
  const label = parts.length > 1 ? parts[1] : parts[0];
  return label.toUpperCase().replace("X-", "");
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function FileInfoCard({
  fileName,
  fileSize,
  fileType,
  hash,
  hashLoading = false,
  className,
}: FileInfoCardProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-slate bg-carbon p-4 space-y-3",
        className,
      )}
    >
      {/* File identity row */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-md bg-graphite flex items-center justify-center shrink-0">
          <FileAudio size={18} className="text-forensic-blue" />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-sans font-medium text-bone truncate"
            title={fileName}
          >
            {fileName}
          </p>

          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-sans text-ash">
              {formatFileSize(fileSize)}
            </span>
            <Badge variant="info" className="text-[10px] px-1.5 py-0">
              {formatType(fileType)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Hash section */}
      <div className="border-t border-slate/50 pt-3">
        {hashLoading ? (
          <div className="flex items-center gap-2 text-xs text-ash">
            <Loader2 size={14} className="animate-spin text-forensic-blue" />
            <span className="font-sans">Computing file hash...</span>
          </div>
        ) : hash ? (
          <HashDisplay hash={hash} className="w-full" />
        ) : (
          <span className="text-xs font-sans text-ash/50">
            Hash not computed
          </span>
        )}
      </div>
    </div>
  );
}
