"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { CheckCircle, XCircle, Loader2, Upload, Search } from "lucide-react";

interface VerificationResult {
  valid: boolean;
  hash: string;
  hashType?: string;
  entity?: { type: string; idPrefix: string };
  chainEntry?: { action: string; recordedAt: string; hasArtifact: boolean };
  chainIntegrity?: { totalEntries: number };
  analysis?: { status: string; pipelineVersion: string; completedAt: string };
  probatioVerification?: { verifiedAt: string; verificationUrl: string };
  message?: string;
}

interface BatchResult {
  results: Array<{ hash: string; valid: boolean; hashType?: string; action?: string }>;
  summary: { total: number; valid: number; invalid: number };
}

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const [hash, setHash] = useState(searchParams.get("hash") || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [mode, setMode] = useState<"single" | "batch">("single");

  // Auto-verify if hash in URL
  useEffect(() => {
    const urlHash = searchParams.get("hash");
    if (urlHash && /^[0-9a-f]{64}$/i.test(urlHash)) {
      setHash(urlHash);
      verifySingle(urlHash);
    }
  }, [searchParams]);

  async function verifySingle(hashToVerify?: string) {
    const h = (hashToVerify || hash).trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/i.test(h)) return;

    setLoading(true);
    setResult(null);
    setBatchResult(null);

    try {
      const res = await fetch(`/api/verify/hash/${h}`);
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ valid: false, hash: h, message: "Verification request failed." });
    } finally {
      setLoading(false);
    }
  }

  async function handleBatchUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult(null);
    setBatchResult(null);

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // Extract hashes from chain-of-custody JSON
      let hashes: string[] = [];
      if (Array.isArray(json.entries)) {
        hashes = json.entries.map((e: Record<string, string>) => e.entry_hash).filter(Boolean);
      } else if (Array.isArray(json)) {
        hashes = json.map((e: Record<string, string>) => e.entry_hash || e.hash).filter(Boolean);
      }

      if (hashes.length === 0) {
        setBatchResult({ results: [], summary: { total: 0, valid: 0, invalid: 0 } });
        return;
      }

      const res = await fetch("/api/verify/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hashes }),
      });
      const data = await res.json();
      setBatchResult(data);
    } catch {
      setBatchResult({ results: [], summary: { total: 0, valid: 0, invalid: 0 } });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ivory">
      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-2xl font-semibold text-obsidian mb-1">
            PROBATIO · VERIFY
          </h1>
          <p className="text-sm text-ash">
            Independent Chain of Custody Verification
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <button
            onClick={() => { setMode("single"); setBatchResult(null); }}
            className={cn(
              "px-4 py-2 text-sm rounded-md transition-colors",
              mode === "single" ? "bg-obsidian text-bone" : "bg-slate/10 text-ash hover:text-obsidian"
            )}
          >
            <Search size={14} className="inline mr-1.5" />
            Verify Hash
          </button>
          <button
            onClick={() => { setMode("batch"); setResult(null); }}
            className={cn(
              "px-4 py-2 text-sm rounded-md transition-colors",
              mode === "batch" ? "bg-obsidian text-bone" : "bg-slate/10 text-ash hover:text-obsidian"
            )}
          >
            <Upload size={14} className="inline mr-1.5" />
            Verify Package
          </button>
        </div>

        {/* Single hash input */}
        {mode === "single" && (
          <div className="mb-8">
            <label className="text-xs text-ash mb-2 block">
              Paste a hash from a Probatio evidence package or report
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={hash}
                onChange={(e) => setHash(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verifySingle()}
                placeholder="a3f8c2d1e5b7a9c0d3f6e8b1a4c7d0e3f5a8b2c4d6e9f0a1b3c5d7e8f0a2b4"
                className="flex-1 px-3 py-2.5 rounded-md border border-slate/30 font-mono text-sm bg-white text-obsidian placeholder:text-ash/40 focus:outline-none focus:ring-2 focus:ring-forensic-blue/50"
              />
              <button
                onClick={() => verifySingle()}
                disabled={loading || hash.length !== 64}
                className="px-5 py-2.5 bg-obsidian text-bone rounded-md text-sm font-medium hover:bg-obsidian/90 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : "Verify"}
              </button>
            </div>
          </div>
        )}

        {/* Batch upload */}
        {mode === "batch" && (
          <div className="mb-8">
            <label className="text-xs text-ash mb-2 block">
              Upload chain-of-custody.json from an evidence package
            </label>
            <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate/30 rounded-lg cursor-pointer hover:border-forensic-blue/30 transition-colors">
              <Upload size={20} className="text-ash mb-2" />
              <span className="text-sm text-ash">Drop JSON file or click to browse</span>
              <input type="file" accept=".json" onChange={handleBatchUpload} className="hidden" />
            </label>
          </div>
        )}

        {/* Single result */}
        {result && (
          <div className={cn(
            "rounded-lg border p-6 mb-6",
            result.valid ? "border-risk-low/30 bg-risk-low/5" : "border-signal-red/30 bg-signal-red/5"
          )}>
            <div className="flex items-center gap-2 mb-4">
              {result.valid ? (
                <CheckCircle size={20} className="text-risk-low" />
              ) : (
                <XCircle size={20} className="text-signal-red" />
              )}
              <span className={cn("text-lg font-semibold", result.valid ? "text-risk-low" : "text-signal-red")}>
                {result.valid ? "HASH VERIFIED" : "HASH NOT FOUND"}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="font-mono text-xs text-ash break-all">{result.hash}</div>

              {result.valid && result.hashType && (
                <div className="text-obsidian">
                  Type: {result.hashType === "chain_entry" ? "Chain Entry" : result.hashType === "artifact" ? "Artifact Hash" : "Analysis Hash"}
                </div>
              )}

              {result.chainEntry && (
                <>
                  <div className="text-obsidian">Action: {result.chainEntry.action}</div>
                  <div className="text-ash">Recorded: {new Date(result.chainEntry.recordedAt).toLocaleString()}</div>
                </>
              )}

              {result.entity && (
                <div className="text-ash">Entity: {result.entity.type} ({result.entity.idPrefix}...)</div>
              )}

              {result.chainIntegrity && (
                <div className="text-obsidian font-medium">
                  Chain: {result.chainIntegrity.totalEntries} entries
                </div>
              )}

              {result.analysis && (
                <>
                  <div className="text-obsidian">Status: {result.analysis.status}</div>
                  <div className="text-ash">Pipeline: {result.analysis.pipelineVersion}</div>
                </>
              )}

              {result.probatioVerification && (
                <div className="text-xs text-ash mt-3 pt-3 border-t border-slate/20">
                  Verified at: {new Date(result.probatioVerification.verifiedAt).toLocaleString()}
                </div>
              )}

              {!result.valid && (
                <p className="text-ash mt-2">
                  This hash was not found in any Probatio chain of custody.
                  Check that the hash is correctly copied (64 lowercase hex characters).
                </p>
              )}
            </div>
          </div>
        )}

        {/* Batch result */}
        {batchResult && (
          <div className="rounded-lg border border-slate/30 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              {batchResult.summary.invalid === 0 ? (
                <CheckCircle size={20} className="text-risk-low" />
              ) : (
                <XCircle size={20} className="text-signal-red" />
              )}
              <span className="text-lg font-semibold text-obsidian">
                {batchResult.summary.valid} of {batchResult.summary.total} hashes verified
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate/20 text-ash">
                    <th className="text-left py-2 pr-3">#</th>
                    <th className="text-left py-2 pr-3">Hash</th>
                    <th className="text-left py-2 pr-3">Type</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {batchResult.results.map((r, i) => (
                    <tr key={i} className="border-b border-slate/10">
                      <td className="py-1.5 pr-3 text-ash">{i + 1}</td>
                      <td className="py-1.5 pr-3 font-mono text-obsidian">{r.hash.substring(0, 16)}...</td>
                      <td className="py-1.5 pr-3 text-ash">{r.hashType || "—"}</td>
                      <td className="py-1.5">
                        {r.valid ? (
                          <span className="text-risk-low">✓</span>
                        ) : (
                          <span className="text-signal-red">✗</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* About section */}
        <div className="mt-12 pt-8 border-t border-slate/20 text-xs text-ash space-y-3">
          <h2 className="text-sm font-medium text-obsidian">About Probatio Verification</h2>
          <p>
            Probatio maintains an immutable chain of custody for every analysis. Each entry
            contains a SHA-256 hash linking to the previous entry, forming a cryptographic chain.
            This page allows any party to independently verify that a hash from a Probatio
            evidence package or report is authentic.
          </p>
          <p>
            No account is required. No data is accessed beyond the verification result.
            Probatio does not log which hashes are verified or who verifies them.
          </p>
        </div>
      </div>
    </div>
  );
}
