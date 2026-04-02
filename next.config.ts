/**
 * SPECTRA — Next.js Configuration
 *
 * Configures the next-intl plugin for i18n, remote image domains
 * for Supabase Storage, and custom webpack settings for D3.
 */

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // ── Images ───────────────────────────────────────────────────────────
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "**.supabase.in",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // ── Turbopack ───────────────────────────────────────────────────────
  turbopack: {
    root: __dirname,
  },

  // ── Server External Packages ─────────────────────────────────────────
  // Native modules that must not be bundled by Turbopack/Webpack.
  serverExternalPackages: ["@napi-rs/canvas", "archiver"],

  // ── Experimental ─────────────────────────────────────────────────────
  experimental: {
    // Enable server actions (stable in Next.js 15 but ensure opt-in).
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },

  // ── Webpack ──────────────────────────────────────────────────────────
  webpack: (config, { isServer }) => {
    // D3 modules use ES module syntax that can cause issues with
    // server-side rendering. Mark them as external on the server
    // to avoid bundling issues.
    if (isServer) {
      config.externals = config.externals || [];
      // D3 packages that use ESM-only exports.
      const d3Packages = [
        "d3",
        "d3-array",
        "d3-axis",
        "d3-brush",
        "d3-chord",
        "d3-color",
        "d3-contour",
        "d3-delaunay",
        "d3-dispatch",
        "d3-drag",
        "d3-dsv",
        "d3-ease",
        "d3-fetch",
        "d3-force",
        "d3-format",
        "d3-geo",
        "d3-hierarchy",
        "d3-interpolate",
        "d3-path",
        "d3-polygon",
        "d3-quadtree",
        "d3-random",
        "d3-scale",
        "d3-scale-chromatic",
        "d3-selection",
        "d3-shape",
        "d3-time",
        "d3-time-format",
        "d3-timer",
        "d3-transition",
        "d3-zoom",
        "internmap",
        "delaunator",
        "robust-predicates",
      ];

      if (Array.isArray(config.externals)) {
        config.externals.push(
          ({ request }: { request: string }, callback: (err: null, result?: string) => void) => {
            if (d3Packages.some((pkg) => request === pkg || request.startsWith(`${pkg}/`))) {
              return callback(null, `commonjs ${request}`);
            }
            callback(null);
          },
        );
      }
    }

    return config;
  },

  // ── Headers ──────────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  silent: true,
  org: process.env.SENTRY_ORG || "clandestino-ventures",
  project: process.env.SENTRY_PROJECT || "spectra",
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
