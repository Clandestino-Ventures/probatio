"use client";

import { useAuthStore } from "@/stores/auth-store";
import { useCreditStore } from "@/stores/credit-store";
import { Shield, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function ForensicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = useAuthStore();
  const { planTier } = useCreditStore();

  const role = profile?.role ?? "user";
  const tier = planTier ?? profile?.plan_tier ?? "free";

  const canAccess =
    tier === "professional" ||
    tier === "enterprise" ||
    role === "user" ||
    role === "expert" ||
    role === "admin";

  if (!canAccess) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-evidence-gold/10 flex items-center justify-center mx-auto mb-5">
            <Shield size={24} className="text-evidence-gold" />
          </div>
          <h2 className="text-xl font-semibold text-bone mb-2">
            Forensic Analysis
          </h2>
          <p className="text-sm text-ash mb-2">
            Court-admissible Track A vs Track B comparison with cryptographic
            chain of custody and segment-level evidence.
          </p>
          <p className="text-sm text-ash mb-6">
            Available on Professional and Enterprise plans.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-forensic-blue text-bone rounded-md text-sm font-medium hover:bg-forensic-blue/90 transition-colors"
          >
            Upgrade to Professional
            <ArrowRight size={14} />
          </Link>
          <p className="text-xs text-ash mt-4">
            $5,000 per forensic case. Includes sealed evidence package.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
