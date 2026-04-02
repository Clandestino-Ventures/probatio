// @ts-nocheck
/**
 * PROBATIO — Audit Export API
 *
 * POST /api/admin/audit-export — Generate compliance audit report.
 * Auth: Platform admin (any org) OR org admin/owner (own org only).
 * Body: { organization_id?, date_from, date_to, format: 'json' | 'csv' }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserOrganizationId } from "@/lib/auth/plan-check";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      organization_id,
      date_from,
      date_to,
      format = "json",
    } = body as {
      organization_id?: string;
      date_from: string;
      date_to: string;
      format?: "json" | "csv";
    };

    if (!date_from || !date_to) {
      return NextResponse.json(
        { error: "date_from and date_to are required" },
        { status: 400 },
      );
    }

    // Determine which org to export
    let targetOrgId = organization_id;

    // Check if platform admin
    const { data: profile } = await admin
      .from("profiles")
      .select("role, organization_id")
      .eq("id", user.id)
      .single() as { data: { role: string; organization_id: string | null } | null };

    const isPlatformAdmin = profile?.role === "admin";

    if (!isPlatformAdmin) {
      // Must be org admin/owner exporting their own org
      const userOrgId = profile?.organization_id;
      if (!userOrgId) {
        return NextResponse.json(
          { error: "You must belong to an organization" },
          { status: 403 },
        );
      }

      // Verify admin/owner role
      const { data: membership } = await admin
        .from("organization_members")
        .select("role")
        .eq("organization_id", userOrgId)
        .eq("user_id", user.id)
        .single() as { data: { role: string } | null };

      if (!membership || (membership.role !== "admin" && membership.role !== "owner")) {
        return NextResponse.json(
          { error: "Admin or owner role required" },
          { status: 403 },
        );
      }

      targetOrgId = userOrgId;
    }

    // Fetch analyses for the org's users
    let analysesQuery = admin
      .from("analyses")
      .select("id, user_id, file_name, mode, status, overall_risk, overall_score, clearance_status, pipeline_version, created_at")
      .gte("created_at", date_from)
      .lte("created_at", date_to)
      .order("created_at", { ascending: false });

    if (targetOrgId) {
      // Get org member user IDs
      const { data: members } = await admin
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", targetOrgId);

      const memberIds = (members ?? []).map((m) => m.user_id);
      if (memberIds.length > 0) {
        analysesQuery = analysesQuery.in("user_id", memberIds);
      }
    }

    const { data: analyses } = await analysesQuery;

    // Credit usage
    let creditQuery = admin
      .from("credit_usage")
      .select("id, user_id, action, amount, balance_after, description, created_at")
      .gte("created_at", date_from)
      .lte("created_at", date_to)
      .order("created_at", { ascending: false });

    if (targetOrgId) {
      const { data: members } = await admin
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", targetOrgId);

      const memberIds = (members ?? []).map((m) => m.user_id);
      if (memberIds.length > 0) {
        creditQuery = creditQuery.in("user_id", memberIds);
      }
    }

    const { data: creditUsage } = await creditQuery;

    // Custody entries
    const analysisIds = (analyses ?? []).map((a) => a.id);
    let custodyEntries: unknown[] = [];
    if (analysisIds.length > 0) {
      const { data } = await admin
        .from("audit_log")
        .select("entity_id, action, metadata, created_at")
        .eq("entity_type", "analysis")
        .in("entity_id", analysisIds.slice(0, 100))
        .order("created_at", { ascending: false })
        .limit(500);

      custodyEntries = data ?? [];
    }

    const exportData = {
      export_metadata: {
        generated_at: new Date().toISOString(),
        generated_by: user.id,
        organization_id: targetOrgId ?? "all",
        date_range: { from: date_from, to: date_to },
        record_counts: {
          analyses: (analyses ?? []).length,
          credit_transactions: (creditUsage ?? []).length,
          custody_entries: custodyEntries.length,
        },
      },
      analyses: analyses ?? [],
      credit_usage: creditUsage ?? [],
      custody_entries: custodyEntries,
    };

    if (format === "csv") {
      // Convert analyses to CSV
      const headers = ["id", "user_id", "file_name", "mode", "status", "overall_risk", "overall_score", "clearance_status", "pipeline_version", "created_at"];
      const rows = [
        headers.join(","),
        ...(analyses ?? []).map((a) =>
          headers.map((h) => {
            const val = (a as Record<string, unknown>)[h];
            return typeof val === "string" && val.includes(",")
              ? `"${val}"`
              : String(val ?? "");
          }).join(","),
        ),
      ];

      return new NextResponse(rows.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="probatio-audit-${date_from}-to-${date_to}.csv"`,
        },
      });
    }

    return NextResponse.json(exportData, {
      headers: {
        "Content-Disposition": `attachment; filename="probatio-audit-${date_from}-to-${date_to}.json"`,
      },
    });
  } catch (error) {
    console.error("[POST /api/admin/audit-export]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
