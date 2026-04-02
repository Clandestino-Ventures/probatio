"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import { Button, Input } from "@/components/ui";
import { Mail, Lock, User, Building2, Chrome } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const t = useTranslations('auth.signUp');
  const tVerify = useTranslations('auth.verifyEmail');
  const tPrefs = useTranslations('settings.preferences');
  const { signUp, signInWithOAuth, loading, error, clearError } =
    useAuthStore();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organization, setOrganization] = useState("");
  const [preferredLang, setPreferredLang] = useState("en");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    const { error: signUpError } = await signUp(email, password, {
      fullName: displayName,
      organization,
      preferredLang,
    });
    if (!signUpError) {
      setSubmitted(true);
    }
  }

  async function handleGoogleSignUp() {
    clearError();
    await signInWithOAuth("google");
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-obsidian px-4">
        <div className="w-full max-w-100 text-center">
          <div className="mb-6">
            <Link href="/">
              <h1 className="font-display text-3xl tracking-wide uppercase text-bone">
                PROBATIO
              </h1>
            </Link>
          </div>
          <div className="bg-carbon border border-slate rounded-lg p-8">
            <div className="w-12 h-12 bg-forensic-blue/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail size={24} className="text-forensic-blue" />
            </div>
            <h2 className="text-xl font-semibold text-bone mb-2">
              {tVerify('title')}
            </h2>
            <p className="text-sm text-ash mb-6">
              {tVerify('subtitle', { email })}
            </p>
            <Link
              href="/login"
              className="text-sm text-forensic-blue hover:text-forensic-blue/80 transition-colors"
            >
              {t('signInLink')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-obsidian px-4 py-12">
      <div className="w-full max-w-100">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/">
            <h1 className="font-display text-3xl tracking-wide uppercase text-bone">
              PROBATIO
            </h1>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-carbon border border-slate rounded-lg p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-bone mb-1">
              {t('title')}
            </h2>
            <p className="text-sm text-ash">
              {t('subtitle')}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-signal-red/10 border border-signal-red/30 rounded-md text-signal-red text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t('fullNameLabel')}
              type="text"
              placeholder={t('fullNamePlaceholder')}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              startIcon={<User size={16} />}
              required
              autoComplete="name"
            />

            <Input
              label={t('emailLabel')}
              type="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              startIcon={<Mail size={16} />}
              required
              autoComplete="email"
            />

            <Input
              label={t('passwordLabel')}
              type="password"
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              startIcon={<Lock size={16} />}
              hint={t('passwordHint')}
              required
              autoComplete="new-password"
              minLength={8}
            />

            <Input
              label={t('organizationLabel')}
              type="text"
              placeholder={t('organizationPlaceholder')}
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              startIcon={<Building2 size={16} />}
              hint={t('organizationPlaceholder', { defaultValue: 'Optional' })}
              autoComplete="organization"
            />

            {/* Language Preference */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-sans font-medium text-bone/80">
                {tPrefs('language')}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPreferredLang('en')}
                  className={cn(
                    "flex-1 h-10 rounded-md text-sm font-medium transition-colors",
                    preferredLang === 'en' ? "bg-forensic-blue text-bone" : "bg-graphite text-ash border border-slate"
                  )}
                >EN</button>
                <button
                  type="button"
                  onClick={() => setPreferredLang('es')}
                  className={cn(
                    "flex-1 h-10 rounded-md text-sm font-medium transition-colors",
                    preferredLang === 'es' ? "bg-forensic-blue text-bone" : "bg-graphite text-ash border border-slate"
                  )}
                >ES</button>
              </div>
            </div>

            <Button
              type="submit"
              fullWidth
              loading={loading}
              disabled={!displayName || !email || !password}
            >
              {t('submitButton')}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-carbon px-3 text-ash">{t('divider')}</span>
            </div>
          </div>

          <Button
            variant="outline"
            fullWidth
            onClick={handleGoogleSignUp}
            disabled={loading}
          >
            <Chrome size={16} />
            Continue with Google
          </Button>

          <p className="mt-6 text-center text-xs text-ash">
            {t('terms', {
              termsLink: t('termsLink'),
              privacyLink: t('privacyLink'),
            })}
          </p>

          <p className="mt-4 text-center text-sm text-ash">
            {t('hasAccount')}{" "}
            <Link
              href="/login"
              className="text-forensic-blue hover:text-forensic-blue/80 transition-colors font-medium"
            >
              {t('signInLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
