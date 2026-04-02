import { describe, it, expect, beforeAll } from "vitest";
import { generateKeyPairSync } from "crypto";

// Set up test keys before importing signing module
beforeAll(() => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  process.env.PROBATIO_SIGNING_PRIVATE_KEY = privateKey
    .export({ type: "pkcs8", format: "der" })
    .toString("base64");
  process.env.PROBATIO_SIGNING_PUBLIC_KEY = publicKey
    .export({ type: "spki", format: "der" })
    .toString("base64");
});

describe("Ed25519 Signing", () => {
  it("signs and verifies a buffer correctly", async () => {
    const { signBuffer, verifySignature } = await import(
      "@/lib/crypto/signing"
    );
    const buffer = Buffer.from("test data for signing");
    const result = signBuffer(buffer);

    expect(result.signature).toBeDefined();
    expect(result.signature.length).toBeGreaterThan(0);
    expect(result.algorithm).toBe("Ed25519");
    expect(result.signed_hash).toHaveLength(64); // SHA-256 hex
    expect(result.signed_at).toBeDefined();
    expect(result.public_key_url).toContain("public-key");

    expect(verifySignature(buffer, result.signature)).toBe(true);
  });

  it("rejects tampered buffer", async () => {
    const { signBuffer, verifySignature } = await import(
      "@/lib/crypto/signing"
    );
    const buffer = Buffer.from("original data");
    const result = signBuffer(buffer);

    const tampered = Buffer.from("tampered data");
    expect(verifySignature(tampered, result.signature)).toBe(false);
  });

  it("rejects invalid signature", async () => {
    const { verifySignature } = await import("@/lib/crypto/signing");
    const buffer = Buffer.from("test data");

    // Invalid base64 that decodes to wrong-length bytes
    expect(verifySignature(buffer, "aW52YWxpZA==")).toBe(false);
  });

  it("produces consistent hashes for same content", async () => {
    const { sha256Hex } = await import("@/lib/crypto/signing");
    const buffer = Buffer.from("deterministic content");
    const hash1 = sha256Hex(buffer);
    const hash2 = sha256Hex(buffer);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("produces different signatures for different content", async () => {
    const { signBuffer } = await import("@/lib/crypto/signing");
    const buffer1 = Buffer.from("content A");
    const buffer2 = Buffer.from("content B");

    const sig1 = signBuffer(buffer1);
    const sig2 = signBuffer(buffer2);

    expect(sig1.signature).not.toBe(sig2.signature);
    expect(sig1.signed_hash).not.toBe(sig2.signed_hash);
  });

  it("isSigningAvailable returns true when keys are set", async () => {
    const { isSigningAvailable } = await import("@/lib/crypto/signing");
    expect(isSigningAvailable()).toBe(true);
  });
});
