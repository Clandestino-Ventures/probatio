"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/stores/auth-store";
import { Coins } from "lucide-react";
import Link from "next/link";

interface CreditDisplayProps {
  className?: string;
}

export function CreditDisplay({ className }: CreditDisplayProps) {
  const t = useTranslations('dashboard.creditWidget');
  const { creditBalance, planTier } = useAuthStore();

  const isLow = creditBalance < 5;
  const planLabel = planTier.charAt(0).toUpperCase() + planTier.slice(1);

  return (
    <div
      className={cn(
        "bg-carbon border border-slate rounded-md p-4",
        className
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <Coins size={16} className="text-evidence-gold" />
        <span className="text-sm font-medium text-bone">{t('title')}</span>
      </div>

      <div className="mb-3">
        <span className="text-2xl font-semibold text-bone">{creditBalance}</span>
        <span className="text-sm text-ash ml-1">credits</span>
      </div>

      {isLow && creditBalance > 0 && (
        <p className="text-xs text-risk-moderate mb-2">
          Credits running low.{" "}
          <Link
            href="/dashboard/settings#billing"
            className="text-forensic-blue hover:underline"
          >
            {t('upgrade')}
          </Link>
        </p>
      )}

      <div className="text-xs text-ash">
        {t('planLabel')}: {planLabel}
      </div>
    </div>
  );
}
