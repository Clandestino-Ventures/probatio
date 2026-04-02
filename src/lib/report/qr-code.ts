/**
 * PROBATIO — QR Code Generation for Certificates
 *
 * Generates QR codes as PNG data URLs for embedding in @react-pdf/renderer
 * documents. The QR code links to the public verification page where
 * anyone can confirm the certificate's authenticity.
 */

import QRCode from "qrcode";

const PROBATIO_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://probatio.audio";

/**
 * Generate a QR code as a PNG data URL.
 * Uses high error correction (Level H) for print reliability.
 */
export async function generateQRCodeDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 200,
    margin: 2,
    color: { dark: "#0A0A0F", light: "#FFFFFF" },
    errorCorrectionLevel: "H",
  });
}

/**
 * Build the verification URL for a clearance certificate.
 * Links to /verify?hash={fileHash} which auto-verifies on load.
 */
export function buildVerificationUrl(fileHash: string): string {
  return `${PROBATIO_BASE_URL}/verify?hash=${fileHash}`;
}
