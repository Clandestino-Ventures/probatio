"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatFileSize, truncateHash } from "@/lib/utils";
import { SUPPORTED_FORMATS, MAX_FILE_SIZE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";
import { Upload, FileAudio, X, Hash } from "lucide-react";

interface UploadZoneProps {
  className?: string;
}

export function UploadZone({ className }: UploadZoneProps) {
  const router = useRouter();
  const t = useTranslations('analysis.new.dropzone');
  const tNew = useTranslations('analysis.new');
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptedTypes = SUPPORTED_FORMATS.map((f) => `.${f}`).join(",");

  const computeHash = useCallback(async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }, []);

  const validateFile = useCallback(
    (file: File): string | null => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !SUPPORTED_FORMATS.includes(ext as never)) {
        return `Unsupported format. Accepted: ${SUPPORTED_FORMATS.join(", ")}`;
      }
      if (file.size > MAX_FILE_SIZE) {
        return `File too large. Maximum: ${formatFileSize(MAX_FILE_SIZE)}`;
      }
      return null;
    },
    []
  );

  const handleFile = useCallback(
    async (selectedFile: File) => {
      setError(null);
      const validationError = validateFile(selectedFile);
      if (validationError) {
        setError(validationError);
        return;
      }
      setFile(selectedFile);
      const hash = await computeHash(selectedFile);
      setFileHash(hash);

      // Validate audio duration
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const arrayBuffer = await selectedFile.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        const durationSeconds = audioBuffer.duration;
        audioContext.close();

        if (durationSeconds < 5) {
          setError('Audio must be at least 5 seconds long.');
          setFile(null);
          setFileHash(null);
          return;
        }
        if (durationSeconds > 15 * 60) {
          setError('Audio must be under 15 minutes.');
          setFile(null);
          setFileHash(null);
          return;
        }
      } catch {
        // If Web Audio API can't decode, let the server validate
      }
    },
    [validateFile, computeHash]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFile(droppedFile);
    },
    [handleFile]
  );

  const handleUpload = async () => {
    if (!file || !fileHash) return;
    setUploading(true);
    setError(null);

    try {
      // Upload file directly to Supabase Storage (bypasses Vercel 4.5MB body limit)
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Session expired. Please sign in again.");

      const pendingPath = `${session.user.id}/pending/${fileHash}/${file.name}`;
      const { error: storageError } = await supabase.storage
        .from("probatio-audio")
        .upload(pendingPath, file, {
          contentType: file.type || "audio/mpeg",
          upsert: true,
        });

      if (storageError) {
        throw new Error(`Storage upload failed: ${storageError.message}`);
      }

      // Send metadata-only request to API (no file in body)
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath: pendingPath,
          fileName: file.name,
          fileHash,
          fileSize: file.size,
          contentType: file.type || "audio/mpeg",
          mode: "screening",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      router.push(`/dashboard/analyses/${data.analysisId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  };

  return (
    <div className={cn("w-full", className)}>
      {!file ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-4 p-12 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
            dragOver
              ? "border-forensic-blue bg-forensic-blue/5"
              : "border-slate hover:border-ash bg-carbon/50"
          )}
        >
          <div className="w-12 h-12 rounded-full bg-graphite flex items-center justify-center">
            <Upload size={20} className="text-ash" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-bone mb-1">
              {t('title')}
            </p>
            <p className="text-xs text-ash">
              {t('hint', { maxSize: formatFileSize(MAX_FILE_SIZE, 0) })}
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={acceptedTypes}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="hidden"
          />
        </div>
      ) : (
        <div className="bg-carbon border border-slate rounded-lg p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-md bg-graphite flex items-center justify-center shrink-0">
                <FileAudio size={18} className="text-forensic-blue" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-bone truncate">
                  {file.name}
                </p>
                <p className="text-xs text-ash">{formatFileSize(file.size)}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setFile(null);
                setFileHash(null);
                setError(null);
              }}
              className="text-ash hover:text-bone transition-colors p-1"
            >
              <X size={16} />
            </button>
          </div>

          {fileHash && (
            <div className="flex items-center gap-2 mb-4 p-2 bg-graphite rounded-md">
              <Hash size={14} className="text-ash shrink-0" />
              <span className="text-xs font-mono text-ash truncate">
                SHA-256: {truncateHash(fileHash, 12, 12)}
              </span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-signal-red/10 border border-signal-red/30 rounded-md text-signal-red text-sm">
              {error}
            </div>
          )}

          <Button
            onClick={handleUpload}
            fullWidth
            loading={uploading}
            disabled={!fileHash}
          >
            {uploading ? t('uploading') : tNew('submit')}
          </Button>
        </div>
      )}
    </div>
  );
}
