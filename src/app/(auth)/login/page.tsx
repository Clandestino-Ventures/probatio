"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/stores/auth-store";
import { Button, Input } from "@/components/ui";
import { Mail, Lock, Chrome } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const t = useTranslations('auth.signIn');
  const { signIn, signInWithOAuth, loading, error, clearError } =
    useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    const { error: signInError } = await signIn(email, password);
    if (!signInError) {
      router.push(redirect);
    }
  }

  async function handleGoogleSignIn() {
    clearError();
    await signInWithOAuth("google");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-obsidian px-4">
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
            <h2 className="text-xl font-semibold text-bone mb-1">{t('title')}</h2>
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
              required
              autoComplete="current-password"
            />

            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-xs text-forensic-blue hover:text-forensic-blue/80 transition-colors"
              >
                {t('forgotPassword')}
              </Link>
            </div>

            <Button
              type="submit"
              fullWidth
              loading={loading}
              disabled={!email || !password}
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
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <Chrome size={16} />
            {t('google')}
          </Button>

          <p className="mt-6 text-center text-sm text-ash">
            {t('noAccount')}{" "}
            <Link
              href="/signup"
              className="text-forensic-blue hover:text-forensic-blue/80 transition-colors font-medium"
            >
              {t('signUpLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
