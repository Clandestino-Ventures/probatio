"use client";

import { useTranslations } from "next-intl";
import { useAuthStore } from "@/stores/auth-store";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from "@/components/ui";
import { User, Settings, CreditCard, LogOut, Activity, AlertTriangle, Coins } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
  activeCount?: number;
  attentionCount?: number;
}

export function Header({ title, activeCount = 0, attentionCount = 0 }: HeaderProps) {
  const router = useRouter();
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const { profile, creditBalance, signOut } = useAuthStore();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  const creditWarning = creditBalance === 0;

  return (
    <header className="flex items-center justify-between h-14 px-4 lg:px-6 border-b border-slate bg-carbon/50 backdrop-blur-sm">
      {/* Left: Title (with mobile padding for hamburger) */}
      <h1 className="text-lg font-semibold text-bone pl-10 lg:pl-0 truncate">
        {title}
      </h1>

      {/* Right: Intelligence pills + User menu */}
      <div className="flex items-center gap-2 lg:gap-4">
        {/* Intelligence pills */}
        <div className="hidden sm:flex items-center gap-2">
          {activeCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-forensic-blue/10 rounded-full">
              <Activity size={12} className="text-forensic-blue" />
              <span className="text-xs font-medium text-forensic-blue">
                {activeCount} active
              </span>
            </div>
          )}

          {attentionCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-signal-red/10 rounded-full">
              <AlertTriangle size={12} className="text-signal-red" />
              <span className="text-xs font-medium text-signal-red">
                {attentionCount} attention
              </span>
            </div>
          )}
        </div>

        {/* Credits */}
        <div
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full",
            creditWarning ? "bg-signal-red/10" : "bg-graphite"
          )}
        >
          <Coins size={12} className={creditWarning ? "text-signal-red" : "text-ash"} />
          <span
            className={cn(
              "text-xs font-medium",
              creditWarning ? "text-signal-red" : "text-bone"
            )}
          >
            {creditBalance} <span className="text-ash">credits</span>
          </span>
        </div>

        {/* User Menu */}
        <Dropdown>
          <DropdownTrigger className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-slate/20 transition-colors">
            <div className="w-7 h-7 rounded-full bg-graphite border border-slate flex items-center justify-center">
              <span className="text-xs font-medium text-bone">
                {profile?.display_name?.charAt(0)?.toUpperCase() || <User size={14} className="text-ash" />}
              </span>
            </div>
            <span className="text-sm text-bone hidden lg:inline">
              {profile?.display_name || "Account"}
            </span>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownItem onClick={() => router.push("/dashboard/settings")}>
              <Settings size={14} />
              {tNav("settings")}
            </DropdownItem>
            <DropdownItem onClick={() => router.push("/dashboard/settings#plan-usage")}>
              <CreditCard size={14} />
              {tNav("billing")}
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem onClick={handleSignOut} destructive>
              <LogOut size={14} />
              {tCommon("signOut")}
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>
    </header>
  );
}
