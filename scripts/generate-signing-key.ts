/**
 * PROBATIO — Ed25519 Signing Key Generation
 *
 * Run ONCE to generate a keypair for signing evidence packages and PDFs.
 *
 * Usage: npx tsx scripts/generate-signing-key.ts
 *
 * Output:
 *   PROBATIO_SIGNING_PRIVATE_KEY=<base64>  → Store in .env.local + Vercel env vars
 *   PROBATIO_SIGNING_PUBLIC_KEY=<base64>   → Store in .env.local + publish on website
 *
 * NEVER commit the private key. NEVER share it. NEVER log it in production.
 */

import { generateKeyPairSync } from "crypto";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");

const privateKeyBase64 = privateKey
  .export({ type: "pkcs8", format: "der" })
  .toString("base64");
const publicKeyBase64 = publicKey
  .export({ type: "spki", format: "der" })
  .toString("base64");

console.log("\n╔══════════════════════════════════════════════════════╗");
console.log("║  PROBATIO — Ed25519 Signing Key Generated            ║");
console.log("╚══════════════════════════════════════════════════════╝\n");

console.log("Add to .env.local and Vercel environment variables:\n");
console.log(`PROBATIO_SIGNING_PRIVATE_KEY=${privateKeyBase64}`);
console.log(`PROBATIO_SIGNING_PUBLIC_KEY=${publicKeyBase64}`);

console.log("\n─────────────────────────────────────────────────────");
console.log("PRIVATE KEY: Store in .env.local + Vercel. NEVER commit.");
console.log("PUBLIC KEY:  Also publish at probatio.audio/api/verify/public-key");
console.log("─────────────────────────────────────────────────────\n");
