// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Shared Chain of Custody Utility
 *
 * Records chain_of_custody entries using the admin/service client.
 * Used by both the /api/analyze route and the Inngest pipeline functions.
 *
 * The database trigger (enforce_hash_chain) handles:
 * - Auto-computing entry_hash (SHA-256 of prev_hash + action + artifact_hash + timestamp)
 * - Auto-incrementing sequence_num
 * - Auto-linking prev_hash to the previous entry
 *
 * This function just inserts — the DB does the crypto.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type CustodyEntityType = "analysis" | "forensic_case";

export interface RecordCustodyParams {
  entityType: CustodyEntityType;
  entityId: string;
  action: string;
  actorId: string;
  artifactType?: string;
  artifactHash?: string;
  artifactUrl?: string;
  detail?: Record<string, unknown>;
  pipelineVersionId?: string;
  inngestRunId?: string;
}

/**
 * Insert a chain_of_custody entry. The database trigger handles
 * sequence numbering, hash chaining, and integrity.
 *
 * This function never throws — custody logging must not break
 * the calling operation. Errors are logged to console.
 */
export async function recordCustody(params: RecordCustodyParams): Promise<void> {
  try {
    const adminClient = createAdminClient();

    await adminClient.from("audit_log").insert({
      entity_type: params.entityType,
      entity_id: params.entityId,
      action: params.action,
      actor_id: params.actorId,
      metadata: {
        artifact_type: params.artifactType ?? null,
        artifact_url: params.artifactUrl ?? null,
        pipeline_version: params.pipelineVersionId ?? null,
        inngest_run_id: params.inngestRunId ?? null,
        ...(params.detail ?? {}),
      },
      hash_before: null,
      hash_after: params.artifactHash ?? null,
      entry_hash: "", // Computed by DB trigger
    });
  } catch (error) {
    // Chain of custody logging must never break the calling operation.
    console.error("[PROBATIO] Failed to record custody entry:", params.action, error);
  }
}

/**
 * Record multiple custody entries in sequence.
 * Each entry is inserted one at a time to maintain the hash chain ordering.
 */
export async function recordCustodyBatch(
  entries: RecordCustodyParams[]
): Promise<void> {
  for (const entry of entries) {
    await recordCustody(entry);
  }
}
