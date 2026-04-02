"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { LanguageToggle } from "./language-toggle";

export function MarketingNav() {
  const t = useTranslations("nav");
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 50);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollTo(id: string) {
    setMobileOpen(false);
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <>
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          scrolled
            ? "bg-obsidian/95 backdrop-blur-md border-b border-slate/50"
            : "bg-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display text-xl tracking-[0.15em] uppercase text-bone">
              PROBATIO
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <button
              onClick={() => scrollTo("modes")}
              className="text-sm text-ash hover:text-bone transition-colors"
            >
              {t("product")}
            </button>
            <button
              onClick={() => scrollTo("pricing")}
              className="text-sm text-ash hover:text-bone transition-colors"
            >
              {t("pricing")}
            </button>
            <Link
              href="/methodology"
              className="text-sm text-ash hover:text-bone transition-colors"
            >
              {t("methodology")}
            </Link>

            <LanguageToggle />

            <Link
              href="/login"
              className="text-sm text-ash hover:text-bone transition-colors"
            >
              {t("signIn")}
            </Link>
            <Link
              href="/signup"
              className="text-sm px-4 py-2 bg-forensic-blue text-bone rounded-md hover:bg-forensic-blue/90 transition-colors font-medium"
            >
              {t("getStarted")}
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-ash hover:text-bone transition-colors"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-carbon border-t border-slate px-4 py-4 space-y-3">
            <button
              onClick={() => scrollTo("modes")}
              className="block w-full text-left text-sm text-ash hover:text-bone py-2"
            >
              {t("product")}
            </button>
            <button
              onClick={() => scrollTo("pricing")}
              className="block w-full text-left text-sm text-ash hover:text-bone py-2"
            >
              {t("pricing")}
            </button>
            <Link
              href="/methodology"
              className="block text-sm text-ash hover:text-bone py-2"
              onClick={() => setMobileOpen(false)}
            >
              {t("methodology")}
            </Link>
            <div className="border-t border-slate pt-3 space-y-2">
              <Link
                href="/login"
                className="block text-sm text-ash hover:text-bone py-2"
                onClick={() => setMobileOpen(false)}
              >
                {t("signIn")}
              </Link>
              <Link
                href="/signup"
                className="block text-sm text-center px-4 py-2 bg-forensic-blue text-bone rounded-md font-medium"
                onClick={() => setMobileOpen(false)}
              >
                {t("getStarted")}
              </Link>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
