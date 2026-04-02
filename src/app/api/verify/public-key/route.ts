/**
 * PROBATIO — Public Signing Key Endpoint
 *
 * GET /api/verify/public-key
 * Returns the Ed25519 public key used to sign evidence packages and PDFs.
 * Public endpoint — no auth required. Anyone can download this to verify
 * Probatio-signed documents independently.
 */

import { NextResponse } from "next/server";

export async function GET() {
  const publicKeyBase64 = process.env.PROBATIO_SIGNING_PUBLIC_KEY;

  if (!publicKeyBase64) {
    return NextResponse.json(
      { error: "Signing public key not configured" },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      algorithm: "Ed25519",
      format: "DER (SPKI), base64-encoded",
      public_key_base64: publicKeyBase64,
      usage:
        "Use this public key to verify Ed25519 signatures on Probatio evidence packages and PDF reports. " +
        "Signatures are provided in the X-Probatio-Signature response header when downloading signed documents.",
      verification_instructions: [
        "1. Download the document (PDF or ZIP evidence package).",
        "2. Note the X-Probatio-Signature header from the download response.",
        "3. Compute SHA-256 of the downloaded file.",
        "4. Verify the Ed25519 signature against the file content using this public key.",
        "5. Or upload the file to probatio.audio/verify for automated verification.",
      ],
    },
    {
      headers: {
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
