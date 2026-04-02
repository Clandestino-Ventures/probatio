"use client";

/**
 * PROBATIO — Hash Display Component
 *
 * Displays a truncated SHA-256 hash with a click-to-copy button.
 * Forensic users copy hashes into legal documents, so the full
 * hash is always available on the clipboard.
 */

import { useState, useCallback } from "react";
import { cn, truncateHash } from "@/lib/utils";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface HashDisplayProps {
  /** Full hex-encoded SHA-256 hash (64 characters). */
  hash: string;
  /** Optional label displayed before the hash. Defaults to "SHA-256". */
  label?: string;
  /** Additional CSS classes. */
  className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function HashDisplay({
  hash,
  label = "SHA-256",
  className,
}: HashDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      toast.success("Hash copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy hash");
    }
  }, [hash]);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-md bg-graphite px-3 py-2",
        className,
      )}
    >
      {label && (
        <span className="text-xs font-sans font-medium text-ash shrink-0">
          {label}:
        </span>
      )}

      <span
        className="font-mono text-xs text-bone/80 select-all"
        title={hash}
      >
        {truncateHash(hash, 8, 8)}
      </span>

      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          "shrink-0 rounded p-1 transition-colors duration-micro",
          "hover:bg-slate/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-forensic-blue",
          copied ? "text-risk-low" : "text-ash hover:text-bone",
        )}
        aria-label={copied ? "Copied" : "Copy full hash to clipboard"}
      >
        {copied ? (
          <Check size={14} aria-hidden="true" />
        ) : (
          <Copy size={14} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
