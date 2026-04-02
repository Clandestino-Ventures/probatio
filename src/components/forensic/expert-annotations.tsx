"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { MessageSquarePlus, Clock, Layers } from "lucide-react";
import type {
  ExpertAnnotationRow,
  ExpertAnnotationInsert,
  MatchDimension,
} from "@/types/database";

// ────────────────────────────────────────────────────────────────────────────
// Layer configuration
// ────────────────────────────────────────────────────────────────────────────

type LayerValue = MatchDimension | "general";

const LAYER_OPTIONS: { value: LayerValue; label: string }[] = [
  { value: "general", label: "General" },
  { value: "melody", label: "Melody" },
  { value: "harmony", label: "Harmony" },
  { value: "rhythm", label: "Rhythm" },
  { value: "timbre", label: "Timbre" },
  { value: "lyrics", label: "Lyrics" },
  { value: "structure", label: "Structure" },
];

/** Tailwind classes for each layer badge, matching DIMENSION_COLORS. */
const LAYER_BADGE_STYLES: Record<LayerValue, string> = {
  melody: "bg-forensic-blue/15 text-forensic-blue border-forensic-blue/30",
  harmony: "bg-evidence-gold/15 text-evidence-gold border-evidence-gold/30",
  rhythm: "bg-signal-red/15 text-signal-red border-signal-red/30",
  timbre: "bg-ash/15 text-ash border-ash/30",
  lyrics: "bg-risk-low/15 text-risk-low border-risk-low/30",
  structure: "bg-risk-moderate/15 text-risk-moderate border-risk-moderate/30",
  general: "bg-ash/15 text-ash border-ash/30",
};

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

interface ExpertAnnotationsProps {
  forensicCaseId: string;
  className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function ExpertAnnotations({
  forensicCaseId,
  className,
}: ExpertAnnotationsProps) {
  const [annotations, setAnnotations] = useState<ExpertAnnotationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formLayer, setFormLayer] = useState<LayerValue>("general");
  const [formTimestamp, setFormTimestamp] = useState("");
  const [formText, setFormText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // ── Fetch annotations ──────────────────────────────────────────────────

  const fetchAnnotations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("expert_annotations")
        .select("*")
        .eq("forensic_case_id", forensicCaseId)
        .order("created_at", { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      setAnnotations((data as ExpertAnnotationRow[]) ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load annotations"
      );
    } finally {
      setLoading(false);
    }
  }, [forensicCaseId]);

  useEffect(() => {
    fetchAnnotations();
  }, [fetchAnnotations]);

  // ── Submit new annotation ──────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const text = formText.trim();
    if (!text) {
      setFormError("Annotation text is required.");
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();

      // Get the current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setFormError("You must be signed in to add annotations.");
        setSubmitting(false);
        return;
      }

      const row: ExpertAnnotationInsert = {
        forensic_case_id: forensicCaseId,
        annotator_id: user.id,
        annotation_text: text,
        timestamp_ref: formTimestamp.trim() || null,
        layer: formLayer === "general" ? undefined : formLayer,
      };

      const { error: insertError } = await supabase
        .from("expert_annotations")
        .insert(row as never);

      if (insertError) {
        setFormError(insertError.message);
        setSubmitting(false);
        return;
      }

      // Reset form and refresh
      setFormText("");
      setFormTimestamp("");
      setFormLayer("general");
      setShowForm(false);
      await fetchAnnotations();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to add annotation"
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className={cn("bg-carbon border border-slate rounded-lg p-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <MessageSquarePlus size={18} className="text-bone" />
          <h3 className="text-lg font-semibold text-bone">
            Expert Annotations
          </h3>
          {annotations.length > 0 && (
            <span className="text-xs text-ash ml-1">
              ({annotations.length})
            </span>
          )}
        </div>
        {!showForm && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm(true)}
          >
            <MessageSquarePlus size={14} />
            Add Annotation
          </Button>
        )}
      </div>

      {/* Add Annotation Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 p-4 bg-graphite border border-slate/50 rounded-md space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Layer selector */}
            <div>
              <label
                htmlFor="annotation-layer"
                className="block text-xs font-medium text-ash mb-1.5"
              >
                Layer
              </label>
              <select
                id="annotation-layer"
                value={formLayer}
                onChange={(e) => setFormLayer(e.target.value as LayerValue)}
                className="w-full h-9 px-3 rounded-md bg-carbon border border-slate text-sm text-bone focus:outline-none focus:ring-1 focus:ring-forensic-blue"
              >
                {LAYER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Timestamp reference */}
            <div>
              <label
                htmlFor="annotation-timestamp"
                className="block text-xs font-medium text-ash mb-1.5"
              >
                Timestamp Reference{" "}
                <span className="text-ash/60">(optional)</span>
              </label>
              <input
                id="annotation-timestamp"
                type="text"
                value={formTimestamp}
                onChange={(e) => setFormTimestamp(e.target.value)}
                placeholder="e.g. 0:45-1:12"
                className="w-full h-9 px-3 rounded-md bg-carbon border border-slate text-sm text-bone placeholder:text-ash/40 focus:outline-none focus:ring-1 focus:ring-forensic-blue font-mono"
              />
            </div>
          </div>

          {/* Annotation text */}
          <div>
            <label
              htmlFor="annotation-text"
              className="block text-xs font-medium text-ash mb-1.5"
            >
              Annotation
            </label>
            <textarea
              id="annotation-text"
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              placeholder="Describe your expert observation..."
              rows={3}
              className="w-full px-3 py-2 rounded-md bg-carbon border border-slate text-sm text-bone placeholder:text-ash/40 focus:outline-none focus:ring-1 focus:ring-forensic-blue resize-y"
            />
          </div>

          {/* Form error */}
          {formError && (
            <p className="text-xs text-signal-red">{formError}</p>
          )}

          {/* Form actions */}
          <div className="flex items-center gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setFormError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={submitting}>
              Submit Annotation
            </Button>
          </div>
        </form>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-forensic-blue border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <p className="text-sm text-signal-red py-4">{error}</p>
      )}

      {/* Empty state */}
      {!loading && !error && annotations.length === 0 && (
        <div className="text-center py-8">
          <Layers size={24} className="text-ash/40 mx-auto mb-2" />
          <p className="text-sm text-ash">
            No expert annotations yet. Add the first one.
          </p>
        </div>
      )}

      {/* Annotations list */}
      {!loading && !error && annotations.length > 0 && (
        <div className="space-y-3">
          {annotations.map((annotation) => (
            <div
              key={annotation.id}
              className="p-4 bg-graphite border border-slate/50 rounded-md"
            >
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {/* Layer badge */}
                <span
                  className={cn(
                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                    LAYER_BADGE_STYLES[annotation.layer]
                  )}
                >
                  {LAYER_OPTIONS.find((o) => o.value === annotation.layer)
                    ?.label ?? annotation.layer}
                </span>

                {/* Timestamp reference */}
                {annotation.timestamp_ref && (
                  <span className="inline-flex items-center gap-1 text-xs text-ash font-mono">
                    <Clock size={11} className="shrink-0" />
                    {annotation.timestamp_ref}
                  </span>
                )}

                {/* Created date — pushed to the right */}
                <span className="text-xs text-ash/60 ml-auto">
                  {formatDate(annotation.created_at)}
                </span>
              </div>

              <p className="text-sm text-bone leading-relaxed whitespace-pre-wrap">
                {annotation.annotation_text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
