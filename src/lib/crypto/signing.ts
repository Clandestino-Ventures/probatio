/**
 * PROBATIO — Ed25519 Document Signing
 *
 * Signs evidence packages and PDF reports with Probatio's Ed25519 private key.
 * Anyone can verify signatures using the public key from /api/verify/public-key.
 *
 * Ed25519 chosen over PGP/RSA because:
 *   - Smaller signatures (64 bytes vs 256+)
 *   - Faster verification
 *   - No key expiration management
 *   - Native Node.js support (crypto.sign/verify)
 */

import {
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
  createHash,
  type KeyObject,
} from "crypto";

const ALGORITHM = "Ed25519";
const PUBLIC_KEY_URL = "https://probatio.audio/api/verify/public-key";

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface SignatureResult {
  /** Base64-encoded Ed25519 signature. */
  signature: string;
  /** SHA-256 hex digest of the signed content. */
  signed_hash: string;
  /** Signing algorithm used. */
  algorithm: string;
  /** ISO timestamp when the signature was created. */
  signed_at: string;
  /** URL where the public key can be downloaded for verification. */
  public_key_url: string;
}

// ────────────────────────────────────────────────────────────────
// Key loading
// ────────────────────────────────────────────────────────────────

function loadPrivateKey(): KeyObject {
  const base64 = process.env.PROBATIO_SIGNING_PRIVATE_KEY;
  if (!base64) {
    throw new Error(
      "PROBATIO_SIGNING_PRIVATE_KEY not configured. Run: npx tsx scripts/generate-signing-key.ts",
    );
  }
  return createPrivateKey({
    key: Buffer.from(base64, "base64"),
    format: "der",
    type: "pkcs8",
  });
}

function loadPublicKey(): KeyObject {
  const base64 = process.env.PROBATIO_SIGNING_PUBLIC_KEY;
  if (!base64) {
    throw new Error(
      "PROBATIO_SIGNING_PUBLIC_KEY not configured. Run: npx tsx scripts/generate-signing-key.ts",
    );
  }
  return createPublicKey({
    key: Buffer.from(base64, "base64"),
    format: "der",
    type: "spki",
  });
}

// ────────────────────────────────────────────────────────────────
// Hashing
// ────────────────────────────────────────────────────────────────

/** Compute SHA-256 hex digest of a buffer. */
export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

// ────────────────────────────────────────────────────────────────
// Signing
// ────────────────────────────────────────────────────────────────

/**
 * Sign a buffer (PDF or ZIP) with Probatio's Ed25519 private key.
 *
 * @param buffer The document content to sign.
 * @returns Signature metadata including base64 signature and content hash.
 */
export function signBuffer(buffer: Buffer): SignatureResult {
  const privateKey = loadPrivateKey();
  const signature = sign(null, buffer, privateKey);
  const contentHash = sha256Hex(buffer);

  return {
    signature: signature.toString("base64"),
    signed_hash: contentHash,
    algorithm: ALGORITHM,
    signed_at: new Date().toISOString(),
    public_key_url: PUBLIC_KEY_URL,
  };
}

/**
 * Check whether signing is available (keys are configured).
 */
export function isSigningAvailable(): boolean {
  return (
    !!process.env.PROBATIO_SIGNING_PRIVATE_KEY &&
    !!process.env.PROBATIO_SIGNING_PUBLIC_KEY
  );
}

// ────────────────────────────────────────────────────────────────
// Verification
// ────────────────────────────────────────────────────────────────

/**
 * Verify an Ed25519 signature against a buffer using Probatio's public key.
 *
 * @param buffer The document content that was signed.
 * @param signatureBase64 Base64-encoded Ed25519 signature.
 * @returns true if signature is valid, false otherwise.
 */
export function verifySignature(
  buffer: Buffer,
  signatureBase64: string,
): boolean {
  try {
    const publicKey = loadPublicKey();
    const sigBuffer = Buffer.from(signatureBase64, "base64");
    return verify(null, buffer, publicKey, sigBuffer);
  } catch {
    return false;
  }
}
