"use client";

import { useEffect } from "react";

export type ShortcutMap = Record<string, () => void>;

/**
 * Global keyboard shortcuts hook. Ignores keypresses when
 * focused on input/textarea/contenteditable elements.
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutMap,
  enabled: boolean = true,
) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      )
        return;

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const combo = `${mod ? "mod+" : ""}${e.shiftKey ? "shift+" : ""}${key}`;

      const action = shortcuts[combo] ?? shortcuts[key];
      if (action) {
        e.preventDefault();
        action();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts, enabled]);
}
