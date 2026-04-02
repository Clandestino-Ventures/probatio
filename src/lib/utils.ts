/**
 * PROBATIO — Shared Utilities
 *
 * Pure helper functions used across the application.
 * No external runtime dependencies — only uses built-in APIs.
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// ────────────────────────────────────────────────────────────────────────────
// Class Name Merging
// ────────────────────────────────────────────────────────────────────────────

/**
 * Merge Tailwind CSS class names with conflict resolution.
 *
 * Uses `clsx` for conditional joining and `tailwind-merge` to
 * de-duplicate / resolve conflicting utility classes.
 *
 * @example
 * cn("px-4 py-2", isActive && "bg-blue-500", "px-6")
 * // => "py-2 px-6 bg-blue-500"  (px-4 removed in favor of px-6)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ────────────────────────────────────────────────────────────────────────────
// Formatting — File Size
// ────────────────────────────────────────────────────────────────────────────

/**
 * Format a byte count into a human-readable string.
 *
 * @param bytes  Non-negative byte count.
 * @param decimals  Number of decimal places (default: 2).
 * @returns Formatted string, e.g. "12.34 MB".
 */
export function formatFileSize(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";
  if (bytes < 0) throw new RangeError("bytes must be non-negative");

  const k = 1024;
  const dm = Math.max(0, decimals);
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"] as const;
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1,
  );

  return `${(bytes / Math.pow(k, i)).toFixed(dm)} ${sizes[i]}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Formatting — Duration
// ────────────────────────────────────────────────────────────────────────────

/**
 * Format seconds into a `mm:ss` or `hh:mm:ss` string.
 *
 * @param totalSeconds  Non-negative duration in seconds.
 * @returns Formatted duration string.
 */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 0) throw new RangeError("totalSeconds must be non-negative");

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (n: number): string => n.toString().padStart(2, "0");

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Formatting — Hash
// ────────────────────────────────────────────────────────────────────────────

/**
 * Truncate a hex hash string for display.
 *
 * @param hash       Full hex hash string.
 * @param prefixLen  Characters to show at the start (default: 8).
 * @param suffixLen  Characters to show at the end (default: 8).
 * @returns Truncated hash, e.g. "a1b2c3d4...e5f6g7h8".
 */
export function truncateHash(
  hash: string,
  prefixLen: number = 8,
  suffixLen: number = 8,
): string {
  if (hash.length <= prefixLen + suffixLen) return hash;
  return `${hash.slice(0, prefixLen)}...${hash.slice(-suffixLen)}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Formatting — Currency
// ────────────────────────────────────────────────────────────────────────────

/**
 * Format a cent amount into a human-readable currency string.
 *
 * @param cents     Amount in cents (integer).
 * @param currency  ISO 4217 currency code (default: "USD").
 * @param locale    BCP 47 locale string (default: "en-US").
 * @returns Formatted currency string, e.g. "$29.00".
 */
export function formatCurrency(
  cents: number,
  currency: string = "USD",
  locale: string = "en-US",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

// ────────────────────────────────────────────────────────────────────────────
// Formatting — Date
// ────────────────────────────────────────────────────────────────────────────

/**
 * Format an ISO 8601 date string (or Date) into a locale-friendly display.
 *
 * @param date    ISO string or Date object.
 * @param style   Intl.DateTimeFormat `dateStyle` option (default: "medium").
 * @param locale  BCP 47 locale string (default: "en-US").
 * @returns Formatted date string, e.g. "Mar 18, 2026".
 */
export function formatDate(
  date: string | Date,
  style: "short" | "medium" | "long" | "full" = "medium",
  locale: string = "en-US",
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, { dateStyle: style }).format(d);
}

// ────────────────────────────────────────────────────────────────────────────
// Miscellaneous
// ────────────────────────────────────────────────────────────────────────────

/**
 * Sleep for a given number of milliseconds. Useful in retry loops.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clamp a number between a minimum and maximum value.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Type-safe check that a value is not null or undefined.
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
