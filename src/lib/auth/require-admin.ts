/**
 * PROBATIO — Platform Admin Auth
 *
 * Platform admins (Clandestino Ventures team) have profiles.role = 'admin'.
 * This is separate from org admin/owner roles.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export class AdminRequiredError extends Error {
  constructor() {
    super("Platform admin access required.");
    this.name = "AdminRequiredError";
  }
}

export async function requireAdmin(userId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single() as { data: { role: string } | null };

  if (!data || data.role !== "admin") {
    throw new AdminRequiredError();
  }
}
