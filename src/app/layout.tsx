import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";
import { PostHogProvider } from "@/components/posthog-provider";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://probatio.audio"
  ),
  title: {
    default: "Probatio — Forensic Audio Intelligence",
    template: "%s | Probatio",
  },
  description:
    "Court-admissible audio similarity analysis for the music industry. Cryptographic chain of custody. 4-dimension forensic comparison.",
  keywords: [
    "forensic audio analysis",
    "music copyright detection",
    "audio similarity",
    "chain of custody",
    "music litigation",
    "copyright infringement",
    "audio forensics",
    "Daubert standard",
    "evidence packaging",
  ],
  authors: [{ name: "Clandestino Ventures, LLC" }],
  creator: "Clandestino Ventures, LLC",
  publisher: "Clandestino Ventures, LLC",
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: "es_PR",
    url: "https://probatio.audio",
    siteName: "Probatio",
    title: "Probatio — Forensic Audio Intelligence",
    description:
      "Court-admissible audio similarity analysis for the music industry. The proof is in the signal.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Probatio — Forensic Audio Intelligence for the Music Industry",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Probatio — Forensic Audio Intelligence",
    description:
      "Court-admissible audio similarity analysis for the music industry. The proof is in the signal.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-obsidian text-bone font-sans">
        <NextIntlClientProvider messages={messages}>
          <PostHogProvider>
            {children}
          </PostHogProvider>
          <Analytics />
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#161618",
                border: "1px solid #3A3A3F",
                color: "#F5F0EB",
                fontFamily: "var(--font-sans)",
              },
            }}
          />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
