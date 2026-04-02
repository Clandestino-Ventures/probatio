"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { LowCreditBanner } from "@/components/billing/low-credit-banner";
import { ShortcutHelp } from "@/components/dashboard/shortcut-help";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, initialized, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (initialized && !user) {
      router.push("/login");
    }
  }, [initialized, user, router]);

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-obsidian">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-evidence-gold border-t-transparent rounded-full animate-spin" />
          <span className="font-display text-lg uppercase text-bone mt-2" style={{ letterSpacing: '0.12em' }}>
            PROBATIO
          </span>
          <span className="text-sm text-ash">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-obsidian overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile nav */}
      <MobileNav>
        <Sidebar />
      </MobileNav>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <LowCreditBanner />
        {children}
      </main>

      {/* Keyboard shortcut help overlay (press ?) */}
      <ShortcutHelp />
    </div>
  );
}
