"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgotPassword');
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        }
      );

      if (resetError) {
        setError(resetError.message);
      } else {
        setSent(true);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
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
          {sent ? (
            <div className="text-center">
              <div className="w-12 h-12 bg-risk-low/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={24} className="text-risk-low" />
              </div>
              <h2 className="text-xl font-semibold text-bone mb-2">
                {t('success')}
              </h2>
              <p className="text-sm text-ash mb-6">
                If an account exists for{" "}
                <span className="text-bone font-medium">{email}</span>,
                you&apos;ll receive a password reset link shortly.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-forensic-blue hover:text-forensic-blue/80 transition-colors"
              >
                <ArrowLeft size={14} />
                {t('backToSignIn')}
              </Link>
            </div>
          ) : (
            <>
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
                  label={t('emailLabel')}
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  startIcon={<Mail size={16} />}
                  required
                  autoComplete="email"
                />

                <Button
                  type="submit"
                  fullWidth
                  loading={loading}
                  disabled={!email}
                >
                  {t('submitButton')}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-sm text-ash hover:text-bone transition-colors"
                >
                  <ArrowLeft size={14} />
                  {t('backToSignIn')}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
