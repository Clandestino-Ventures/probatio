/**
 * PROBATIO — Inngest Serve Endpoint
 *
 * GET, POST, PUT /api/inngest
 *
 * Registers all Inngest functions with the Inngest dev server / cloud.
 * This is the single entrypoint Inngest uses to discover and invoke functions.
 */

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { processAnalysis } from "@/lib/inngest/functions/process-analysis";
import { processForensicAnalysis } from "@/lib/inngest/functions/process-forensic";
import { processClearance } from "@/lib/inngest/functions/process-clearance";
import { processCatalogTrack } from "@/lib/inngest/functions/process-catalog-track";
import { processCatalogBatch } from "@/lib/inngest/functions/process-catalog-batch";
import { catalogCompletionCheck } from "@/lib/inngest/functions/catalog-completion-check";
import { processClearanceBatch } from "@/lib/inngest/functions/process-clearance-batch";
import { clearanceBatchCompletion } from "@/lib/inngest/functions/clearance-batch-completion";
import { clearanceMonitor } from "@/lib/inngest/functions/clearance-monitor";
import { reproduceAnalysis } from "@/lib/inngest/functions/reproduce-analysis";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processAnalysis,
    processForensicAnalysis,
    processClearance,
    processCatalogTrack,
    processCatalogBatch,
    catalogCompletionCheck,
    processClearanceBatch,
    clearanceBatchCompletion,
    clearanceMonitor,
    reproduceAnalysis,
  ],
});
