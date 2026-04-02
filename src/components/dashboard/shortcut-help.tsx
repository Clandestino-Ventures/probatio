"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{ keys: string[]; description: string }>;
}

const GLOBAL_SHORTCUTS: ShortcutGroup = {
  title: "Global",
  shortcuts: [
    { keys: ["?"], description: "Show keyboard shortcuts" },
    { keys: ["N"], description: "New analysis (focus upload)" },
  ],
};

const ANALYSIS_SHORTCUTS: ShortcutGroup = {
  title: "Analysis Detail",
  shortcuts: [
    { keys: ["J"], description: "Next match" },
    { keys: ["K"], description: "Previous match" },
    { keys: ["D"], description: "Cycle dimension filter" },
    { keys: ["E"], description: "Expand/collapse evidence" },
    { keys: ["P"], description: "Play/pause audio" },
    { keys: ["R"], description: "Download report PDF" },
  ],
};

const PLAYBACK_SHORTCUTS: ShortcutGroup = {
  title: "Audio Playback",
  shortcuts: [
    { keys: ["Space"], description: "Play/pause" },
    { keys: ["\u2190"], description: "Seek back 5s" },
    { keys: ["\u2192"], description: "Seek forward 5s" },
  ],
};

function KeyBadge({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded border border-slate bg-graphite text-[10px] font-mono text-bone">
      {children}
    </kbd>
  );
}

export function ShortcutHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "?" && !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  if (!open) return null;

  const groups = [GLOBAL_SHORTCUTS, ANALYSIS_SHORTCUTS, PLAYBACK_SHORTCUTS];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-carbon border border-slate rounded-lg p-6 w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-bone">Keyboard Shortcuts</h3>
          <button onClick={() => setOpen(false)} className="text-ash hover:text-bone">
            <X size={18} />
          </button>
        </div>

        {groups.map((group) => (
          <div key={group.title} className="mb-4">
            <h4 className="text-xs font-medium text-ash uppercase tracking-wide mb-2">
              {group.title}
            </h4>
            <div className="space-y-1.5">
              {group.shortcuts.map((s) => (
                <div
                  key={s.description}
                  className="flex items-center justify-between py-1"
                >
                  <span className="text-sm text-bone">{s.description}</span>
                  <div className="flex gap-1">
                    {s.keys.map((k) => (
                      <KeyBadge key={k}>{k}</KeyBadge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <p className="text-[10px] text-ash mt-4 text-center">
          Press <KeyBadge>?</KeyBadge> to toggle this panel
        </p>
      </div>
    </div>
  );
}
