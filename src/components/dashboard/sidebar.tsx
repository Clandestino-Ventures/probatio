"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useAuthStore, useFirstName } from "@/stores/auth-store";
import {
  LayoutDashboard,
  Upload,
  History,
  Scale,
  Settings,
  Database,
  Building,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

const NAV_ITEMS: Array<{
  labelKey: string;
  href: string;
  icon: typeof LayoutDashboard;
  enterpriseOnly?: boolean;
}> = [
  { labelKey: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "analyses", href: "/dashboard/analyses/new", icon: Upload },
  { labelKey: "history", href: "/dashboard/history", icon: History },
  { labelKey: "forensic", href: "/dashboard/forensic", icon: Scale },
  { labelKey: "catalogs", href: "/dashboard/catalogs", icon: Database, enterpriseOnly: true },
  { labelKey: "organization", href: "/dashboard/organization", icon: Building, enterpriseOnly: true },
  { labelKey: "settings", href: "/dashboard/settings", icon: Settings },
];

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const t = useTranslations('nav');
  const { planTier } = useAuthStore();
  const firstName = useFirstName();

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-carbon border-r border-slate transition-all duration-200",
        collapsed ? "w-15" : "w-60"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center h-14 border-b border-slate px-4",
          collapsed && "justify-center px-0"
        )}
      >
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="font-display text-lg uppercase text-bone" style={{ letterSpacing: '0.12em' }}>
            {collapsed ? "P" : "PROBATIO"}
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {NAV_ITEMS.filter((item) => {
          if (item.enterpriseOnly) {
            return planTier === "enterprise";
          }
          return true;
        }).map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={`nav-${item.labelKey}`}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-forensic-blue/10 text-forensic-blue"
                  : "text-ash hover:text-bone hover:bg-slate/20",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? t(item.labelKey) : undefined}
            >
              <item.icon size={18} className="shrink-0" />
              {!collapsed && <span>{t(item.labelKey)}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User info + Plan Badge + Collapse */}
      <div className="border-t border-slate p-3 space-y-2">
        {!collapsed && (
          <>
            {firstName && (
              <div className="px-2 py-1 text-xs text-ash truncate">
                {firstName}
              </div>
            )}
            <div className="px-2 py-1.5 bg-graphite rounded-md text-center">
              <span className="text-xs text-ash font-medium">
                {PLAN_LABELS[planTier] || "Free"} Plan
              </span>
            </div>
          </>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-1.5 text-ash hover:text-bone transition-colors rounded-md hover:bg-slate/20"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronsRight size={16} />
          ) : (
            <ChevronsLeft size={16} />
          )}
        </button>
      </div>
    </aside>
  );
}
