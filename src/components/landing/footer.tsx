"use client";

/**
 * PROBATIO — Landing Footer
 *
 * Minimal, authoritative footer with wordmark, product links,
 * legal links, company links, and copyright. Fully i18n-aware.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { LanguageToggle } from "./language-toggle";

const linkClass = cn(
  "font-sans text-sm text-ash transition-colors duration-200 hover:text-bone",
);

const columnHeadingClass = cn(
  "mb-4 font-mono text-xs uppercase tracking-wider text-ash/60",
);

export function Footer() {
  const t = useTranslations("footer");

  const productLinks = [
    { label: t("methodology"), href: "/methodology" },
    { label: t("pricing"), href: "/pricing" },
  ];

  const legalLinks = [
    { label: t("terms"), href: "/terms" },
    { label: t("privacy"), href: "/privacy" },
    { label: t("disclaimer"), href: "/disclaimer" },
    { label: t("compliance"), href: "/compliance" },
  ];

  return (
    <footer className="bg-obsidian px-6 py-16">
      <div className="mx-auto max-w-240">
        {/* Top border */}
        <div className="mb-12 h-px bg-slate" />

        {/* Four-column grid */}
        <div className="grid gap-10 md:grid-cols-4">
          {/* Brand column */}
          <div>
            <p
              className="font-display text-lg uppercase text-bone"
              style={{ letterSpacing: "0.12em" }}
            >
              PROBATIO
            </p>
            <p className="mt-2 font-display text-sm italic text-ash">
              {t("tagline")}
            </p>
          </div>

          {/* Product column */}
          <div>
            <p className={columnHeadingClass}>{t("product")}</p>
            <nav className="flex flex-col gap-3">
              {productLinks.map((link) => (
                <Link key={link.href} href={link.href} className={linkClass}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Legal column */}
          <div>
            <p className={columnHeadingClass}>{t("legal")}</p>
            <nav className="flex flex-col gap-3">
              {legalLinks.map((link) => (
                <Link key={link.href} href={link.href} className={linkClass}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Company column */}
          <div>
            <p className={columnHeadingClass}>{t("company")}</p>
            <nav className="flex flex-col gap-3">
              <a href="mailto:contact@probatio.audio" className={linkClass}>
                {t("contact")}
              </a>
            </nav>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate pt-6 md:flex-row">
          <div>
            <p className="font-sans text-[13px] text-ash">
              {t("copyright")} {t("allRightsReserved")}
            </p>
            <p className="font-sans text-[13px] text-ash/60 mt-1">
              {t("builtInPR")}
            </p>
            <p className="font-sans text-[13px] text-ash/45 mt-0.5">
              {t("cvProduct")}
            </p>
          </div>
          <LanguageToggle />
        </div>
      </div>
    </footer>
  );
}
