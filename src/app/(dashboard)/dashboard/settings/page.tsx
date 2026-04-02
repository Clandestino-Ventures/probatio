"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { formatCurrency } from "@/lib/utils";
import { Header } from "@/components/dashboard/header";
import { useAuthStore } from "@/stores/auth-store";
import { useCreditStore } from "@/stores/credit-store";
import { PLANS } from "@/lib/constants";
import { Button, Input, Badge, Progress, Tooltip } from "@/components/ui";
import {
  User,
  CreditCard,
  Shield,
  ExternalLink,
  AlertTriangle,
  Check,
  Activity,
  Download,
  Database,
  Trash2,
  Info,
} from "lucide-react";

// ────────────────────────────────────────────────────────────────────────────
// Tab definitions
// ────────────────────────────────────────────────────────────────────────────

type SettingsTab = "profile" | "plan-usage" | "security";

const TAB_KEYS: { value: SettingsTab; labelKey: string; icon: React.ReactNode }[] = [
  { value: "profile", labelKey: "profile.title", icon: <User size={16} /> },
  { value: "plan-usage", labelKey: "billing.title", icon: <CreditCard size={16} /> },
  { value: "security", labelKey: "security.title", icon: <Shield size={16} /> },
];

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function BillingPortalButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      // No Stripe subscription (manual admin, etc.)
      if (res.status === 404) {
        setMessage("No Stripe subscription to manage — your plan was set manually.");
      } else {
        setMessage(data.error || "Could not open billing portal.");
      }
    } catch {
      setMessage("Could not connect to billing service.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button variant="outline" onClick={handleClick} loading={loading} disabled={loading}>
        <ExternalLink size={14} />
        Stripe Billing Portal
      </Button>
      {message && (
        <p className="text-xs text-ash max-w-xs text-right">{message}</p>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const t = useTranslations('settings');
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  // Check hash on mount for direct links like /settings#plan-usage
  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as SettingsTab;
    if (hash && TAB_KEYS.some((tk) => tk.value === hash)) {
      setActiveTab(hash);
    }
  }, []);

  return (
    <>
      <Header title={t('title')} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-225 mx-auto px-6 py-8 space-y-6">
          {/* Tab Navigation */}
          <div className="flex items-center gap-1 border-b border-slate">
            {TAB_KEYS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative",
                  activeTab === tab.value
                    ? "text-bone"
                    : "text-ash hover:text-bone"
                )}
              >
                {tab.icon}
                {t(tab.labelKey)}
                {activeTab === tab.value && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-forensic-blue rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "profile" && <ProfileTab />}
          {activeTab === "plan-usage" && <PlanUsageTab />}
          {activeTab === "security" && <SecurityTab />}

          {/* Data & Privacy — always visible below all tabs */}
          <DataPrivacySection />
        </div>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Profile Tab
// ────────────────────────────────────────────────────────────────────────────

function ProfileTab() {
  const t = useTranslations('settings.profile');
  const tPrefs = useTranslations('settings.preferences');
  const tCommon = useTranslations('common');
  const { profile, user } = useAuthStore();

  const [displayName, setDisplayName] = useState(
    profile?.display_name || ""
  );
  const [organization, setOrganization] = useState(
    profile?.organization || ""
  );
  const [preferredLanguage, setPreferredLanguage] = useState<"en" | "es">(
    "en"
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);

    // Simulate save — in production this would call an API
    await new Promise((resolve) => setTimeout(resolve, 800));

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-carbon border border-slate rounded-md p-6 space-y-5">
        <h3 className="text-sm font-medium text-bone uppercase tracking-wider">
          {t('title')}
        </h3>

        <Input
          label={t('fullName')}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t('fullName')}
        />

        <Input
          label={t('email')}
          value={user?.email || profile?.email || ""}
          disabled
          hint="Email cannot be changed here. Contact support for assistance."
        />

        <Input
          label={t('organization')}
          value={organization}
          onChange={(e) => setOrganization(e.target.value)}
          placeholder={t('organization')}
        />

        {/* Language Toggle */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-sans font-medium text-bone/80">
            {tPrefs('language')}
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreferredLanguage("en")}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                preferredLanguage === "en"
                  ? "bg-forensic-blue text-bone"
                  : "bg-graphite text-ash hover:text-bone border border-slate"
              )}
            >
              English
            </button>
            <button
              onClick={() => setPreferredLanguage("es")}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                preferredLanguage === "es"
                  ? "bg-forensic-blue text-bone"
                  : "bg-graphite text-ash hover:text-bone border border-slate"
              )}
            >
              Espanol
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleSave} loading={saving} disabled={saving}>
            {saved ? (
              <>
                <Check size={16} />
                {t('saved')}
              </>
            ) : (
              t('save')
            )}
          </Button>
          {saved && (
            <span className="text-sm text-risk-low">
              {t('saved')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Plan & Usage Tab (formerly Billing)
// ────────────────────────────────────────────────────────────────────────────

function PlanUsageTab() {
  const t = useTranslations('settings.billing');
  const { planTier, creditBalance } = useAuthStore();
  const {
    lifetimePurchased,
    lifetimeUsed,
  } = useCreditStore();

  const plan = PLANS[planTier];
  const balance = creditBalance;
  const maxCredits = plan.creditsPerMonth > 0 ? plan.creditsPerMonth : balance;
  const isUnlimited = plan.maxAnalysesPerMonth === null;
  const usagePercent = isUnlimited ? 100 : (maxCredits > 0 ? Math.round((balance / maxCredits) * 100) : 0);

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="bg-carbon border border-slate rounded-md p-6">
        <h3 className="text-sm font-medium text-bone uppercase tracking-wider mb-4">
          {t('currentPlan')}
        </h3>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-forensic-blue/10 flex items-center justify-center">
              <CreditCard size={20} className="text-forensic-blue" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-bone">{plan.name}</h4>
              <p className="text-sm text-ash">
                {plan.priceCentsMonthly > 0
                  ? `${formatCurrency(plan.priceCentsMonthly)}/month`
                  : "Free tier"}
              </p>
            </div>
          </div>
          <Badge variant={planTier === "free" ? "default" : "info"}>
            {plan.name}
          </Badge>
        </div>
      </div>

      {/* Credit Balance */}
      <div className="bg-carbon border border-slate rounded-md p-6">
        <h3 className="text-sm font-medium text-bone uppercase tracking-wider mb-4">
          Credit Balance
        </h3>

        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-semibold text-bone font-mono">{balance}</p>
              <p className="text-xs text-ash mt-1">
                {isUnlimited ? "credits · Unlimited plan" : `of ${maxCredits} credits remaining`}
              </p>
            </div>
            <Badge variant={balance > 0 ? "info" : "risk-critical"}>
              {balance > 0 ? "Active" : "Depleted"}
            </Badge>
          </div>

          <Progress
            value={usagePercent}
            size="md"
            color={balance === 0 ? "red" : usagePercent < 30 ? "gold" : "blue"}
            showPercentage
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div>
              <p className="text-xs text-ash mb-1">Balance</p>
              <p className="text-xl font-semibold text-bone font-mono">{balance}</p>
            </div>
            <div>
              <p className="text-xs text-ash mb-1">Monthly Allowance</p>
              <p className="text-xl font-semibold text-bone font-mono">
                {isUnlimited ? "∞" : (plan.creditsPerMonth || "N/A")}
              </p>
            </div>
            <div>
              <p className="text-xs text-ash mb-1">Lifetime Purchased</p>
              <p className="text-xl font-semibold text-bone font-mono">
                {lifetimePurchased}
              </p>
            </div>
            <div>
              <p className="text-xs text-ash mb-1">Lifetime Used</p>
              <p className="text-xl font-semibold text-bone font-mono">{lifetimeUsed}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Statistics */}
      <div className="bg-carbon border border-slate rounded-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={16} className="text-forensic-blue" />
          <h3 className="text-sm font-medium text-bone uppercase tracking-wider">
            Usage Statistics
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-obsidian rounded-md p-4 border border-slate/50">
            <p className="text-xs text-ash mb-1">Lifetime Purchased</p>
            <p className="text-2xl font-semibold text-bone font-mono">
              {lifetimePurchased}
            </p>
          </div>
          <div className="bg-obsidian rounded-md p-4 border border-slate/50">
            <p className="text-xs text-ash mb-1">Lifetime Used</p>
            <p className="text-2xl font-semibold text-bone font-mono">
              {lifetimeUsed}
            </p>
          </div>
        </div>
      </div>

      {/* Manage Billing */}
      <div className="bg-carbon border border-slate rounded-md p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-medium text-bone mb-1">
              {t('title')}
            </h3>
            <p className="text-xs text-ash">
              {t('subtitle')}
            </p>
          </div>
          <BillingPortalButton />
        </div>
      </div>

      {/* Plan Comparison */}
      <div className="bg-carbon border border-slate rounded-md p-6">
        <h3 className="text-sm font-medium text-bone uppercase tracking-wider mb-4">
          Available Plans
        </h3>

        <div className="space-y-2">
          {(["starter", "professional", "enterprise"] as const).map((tier) => {
            const p = PLANS[tier];
            const monthly = p.priceCentsMonthly / 100;
            const annual = p.priceCentsAnnual / 100;
            const annualSavings = (monthly * 12) - annual;
            const isCurrent = planTier === tier;
            const analyses = p.maxAnalysesPerMonth === null ? "Unlimited" : `${p.creditsPerMonth}/mo`;

            return (
              <div
                key={tier}
                className={cn(
                  "flex items-center justify-between gap-4 px-4 py-3 rounded-md border",
                  isCurrent
                    ? "border-forensic-blue bg-forensic-blue/5"
                    : "border-slate/50"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={cn(
                    "text-sm font-semibold",
                    isCurrent ? "text-forensic-blue" : "text-bone"
                  )}>
                    {p.name}
                  </span>
                  {isCurrent && (
                    <Badge variant="info" className="text-[10px]">Current</Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-ash shrink-0">
                  <span className="font-mono">${monthly}/mo</span>
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline font-mono">${annual.toLocaleString()}/yr</span>
                  {annualSavings > 0 && (
                    <span className="hidden sm:inline text-risk-low">save ${annualSavings.toLocaleString()}</span>
                  )}
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline">{analyses}</span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-ash">
          To change your plan, contact{" "}
          <a href="mailto:sales@probatio.audio" className="text-forensic-blue hover:underline">
            sales@probatio.audio
          </a>
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Security Tab
// ────────────────────────────────────────────────────────────────────────────

function SecurityTab() {
  const t = useTranslations('settings.security');
  const tDanger = useTranslations('settings.danger');
  const tCommon = useTranslations('common');
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!currentPassword) {
      setPasswordError("Current password is required.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setChangingPassword(true);

    try {
      // In production, this would call supabase.auth.updateUser
      await new Promise((resolve) => setTimeout(resolve, 800));

      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch {
      setPasswordError("Failed to update password. Please try again.");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <div className="bg-carbon border border-slate rounded-md p-6 space-y-5">
        <h3 className="text-sm font-medium text-bone uppercase tracking-wider">
          {t('changePassword')}
        </h3>

        <Input
          label="Current Password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Enter current password"
        />

        <Input
          label="New Password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Enter new password"
          hint="Minimum 8 characters"
        />

        <Input
          label="Confirm New Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          error={passwordError || undefined}
        />

        <div className="flex items-center gap-3">
          <Button
            onClick={handleChangePassword}
            loading={changingPassword}
            disabled={changingPassword}
          >
            {t('changePassword')}
          </Button>
          {passwordSuccess && (
            <span className="text-sm text-risk-low flex items-center gap-1">
              <Check size={14} />
              {t('changePassword')} - OK
            </span>
          )}
        </div>
      </div>

      {/* Auth Event Log */}
      <div className="bg-carbon border border-slate rounded-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-forensic-blue" />
          <h3 className="text-sm font-medium text-bone uppercase tracking-wider">
            Authentication Event Log
          </h3>
        </div>

        <div className="py-6 text-center">
          <p className="text-sm text-ash">Auth event log will be available after first login events are recorded.</p>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Data & Privacy Section (always visible at bottom)
// ────────────────────────────────────────────────────────────────────────────

function DataPrivacySection() {
  const tDanger = useTranslations('settings.danger');
  const tCommon = useTranslations('common');
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  return (
    <div className="space-y-4 pt-4 border-t border-slate/50">
      <div className="flex items-center gap-2">
        <Database size={16} className="text-ash" />
        <h3 className="text-sm font-medium text-bone uppercase tracking-wider">
          Data & Privacy
        </h3>
      </div>

      {/* Data Retention Notice */}
      <div className="bg-carbon border border-slate rounded-md p-6">
        <h4 className="text-sm font-medium text-bone mb-3">Data Retention</h4>

        <div className="space-y-2 text-sm text-ash">
          <div className="flex items-start gap-2">
            <Info size={14} className="text-forensic-blue mt-0.5 shrink-0" />
            <p>
              <span className="text-bone font-medium">Audio files</span> are retained for{" "}
              <span className="text-bone font-mono">90 days</span> after upload, then permanently deleted from storage.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Info size={14} className="text-forensic-blue mt-0.5 shrink-0" />
            <p>
              <span className="text-bone font-medium">Forensic data</span> (analysis results, chain of custody, match evidence) is retained{" "}
              <span className="text-bone font-mono">indefinitely</span> for legal and compliance purposes.
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Button
            variant="outline"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                const res = await fetch("/api/user/export-data", { method: "POST" });
                if (!res.ok) throw new Error("Export failed");
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `probatio-data-export-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Data exported successfully");
              } catch {
                toast.error("Failed to export data");
              } finally {
                setExporting(false);
              }
            }}
          >
            <Download size={14} />
            {exporting ? "Exporting..." : "Download My Data"}
          </Button>
          <a
            href="/compliance"
            className="text-xs text-ash/60 hover:text-forensic-blue transition-colors"
          >
            View compliance posture &rarr;
          </a>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-carbon border border-signal-red/30 rounded-md p-6">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={16} className="text-signal-red" />
          <h3 className="text-sm font-medium text-signal-red uppercase tracking-wider">
            {tDanger('title')}
          </h3>
        </div>

        <p className="text-sm text-ash mb-4">
          {tDanger('deleteWarning')}
        </p>

        {!showDeleteWarning ? (
          <Button
            variant="destructive"
            onClick={() => setShowDeleteWarning(true)}
          >
            <Trash2 size={14} />
            {tDanger('deleteAccount')}
          </Button>
        ) : (
          <div className="bg-signal-red/5 border border-signal-red/20 rounded-md p-4 space-y-3">
            <p className="text-sm text-signal-red font-medium">
              Are you absolutely sure?
            </p>
            <p className="text-xs text-ash">
              This will permanently delete your account, all analyses, forensic
              cases, and credit balance. This action is irreversible.
            </p>
            {deleteError && (
              <div className="flex items-start gap-2 bg-signal-red/5 border border-signal-red/20 rounded-md p-3 mb-3">
                <AlertTriangle size={14} className="text-signal-red mt-0.5 shrink-0" />
                <p className="text-xs text-signal-red">{deleteError}</p>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Button
                variant="destructive"
                size="sm"
                loading={deleting}
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  setDeleteError(null);
                  try {
                    const res = await fetch("/api/user/delete", { method: "POST" });
                    const data = await res.json();
                    if (!res.ok) {
                      if (data.error === "active_cases") {
                        setDeleteError(data.message);
                      } else {
                        setDeleteError(data.error || "Failed to delete account.");
                      }
                      return;
                    }
                    // Success — redirect to landing
                    window.location.href = "/";
                  } catch {
                    setDeleteError("Failed to delete account. Please try again.");
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                {tDanger('deleteButton')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteWarning(false)}
              >
                {tCommon('cancel')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
