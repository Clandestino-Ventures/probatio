"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const LOCALE_COOKIE = "SPECTRA_LOCALE";

export function LanguageToggle({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();

  function switchLocale(newLocale: string) {
    if (newLocale === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${newLocale};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`;
    router.refresh();
  }

  return (
    <div className={cn("flex items-center gap-1 text-xs", className)}>
      <button
        onClick={() => switchLocale("en")}
        className={cn(
          "transition-colors",
          locale === "en" ? "text-bone" : "text-ash hover:text-bone"
        )}
      >
        EN
      </button>
      <span className="text-slate">|</span>
      <button
        onClick={() => switchLocale("es")}
        className={cn(
          "transition-colors",
          locale === "es" ? "text-bone" : "text-ash hover:text-bone"
        )}
      >
        ES
      </button>
    </div>
  );
}
