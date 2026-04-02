"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { Header } from "@/components/dashboard/header";
import { Button, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  Building,
  Plus,
  UserPlus,
  Crown,
  Shield,
  User,
  Loader2,
  Lock,
  ChevronDown,
  Trash2,
  ArrowRightLeft,
  Download,
  X,
} from "lucide-react";
import type { OrgRole } from "@/types/database";

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface OrgMember {
  id: string;
  user_id: string;
  role: OrgRole;
  joined_at: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface OrgData {
  organization: {
    id: string;
    name: string;
    slug: string;
    plan_tier: string;
    default_visibility: string;
    created_at: string;
  };
  members: OrgMember[];
  userRole: OrgRole;
  stats: { analyses: number; catalogs: number; members: number };
}

const ROLE_ICONS: Record<OrgRole, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  member: User,
};

const ROLE_COLORS: Record<OrgRole, string> = {
  owner: "text-evidence-gold",
  admin: "text-forensic-blue",
  member: "text-ash",
};

// ────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────

export default function OrganizationPage() {
  const t = useTranslations("organization");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { planTier, profile } = useAuthStore();

  const [orgData, setOrgData] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [transferTarget, setTransferTarget] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orgId = profile?.organization_id;
  const isEnterprise = planTier === "enterprise";

  const fetchOrg = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/organizations/${orgId}`);
      if (res.ok) {
        setOrgData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  // ── Actions ─────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!createName.trim()) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName.trim(), slug: createSlug.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setShowCreate(false);
      window.location.reload();
    } finally {
      setActionLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !orgId) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${orgId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setShowInvite(false);
      setInviteEmail("");
      await fetchOrg();
    } finally {
      setActionLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: "member" | "admin") => {
    if (!orgId) return;
    await fetch(`/api/organizations/${orgId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    await fetchOrg();
  };

  const handleRemove = async (memberId: string) => {
    if (!orgId || !confirm(t("removeMemberConfirm"))) return;
    await fetch(`/api/organizations/${orgId}/members/${memberId}`, { method: "DELETE" });
    await fetchOrg();
  };

  const handleTransfer = async () => {
    if (!orgId || !transferTarget) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${orgId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_owner_user_id: transferTarget }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setShowTransfer(false);
      await fetchOrg();
    } finally {
      setActionLoading(false);
    }
  };

  // ── Not Enterprise ──────────────────────────────────────────
  if (!isEnterprise) {
    return (
      <>
        <Header title={t("title")} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <Lock size={48} className="text-ash" />
          <p className="text-ash text-center">{t("planRequired")}</p>
          <Button onClick={() => router.push("/dashboard/settings")}>{t("upgrade")}</Button>
        </div>
      </>
    );
  }

  // ── Loading ─────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <Header title={t("title")} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-forensic-blue" />
        </div>
      </>
    );
  }

  // ── No org yet — Create ─────────────────────────────────────
  if (!orgId || !orgData) {
    return (
      <>
        <Header title={t("title")} />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto px-6 py-16">
            <div className="bg-carbon border border-slate rounded-lg p-8 text-center">
              <Building size={48} className="mx-auto text-evidence-gold mb-4" />
              <h2 className="text-xl font-semibold text-bone mb-2">{t("createTitle")}</h2>
              <p className="text-sm text-ash mb-6">{t("createDescription")}</p>

              <div className="space-y-4 text-left">
                <div>
                  <label className="text-xs text-ash block mb-1">{t("orgName")}</label>
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder={t("orgNamePlaceholder")}
                    className="w-full px-3 py-2 bg-graphite border border-slate rounded-md text-sm text-bone placeholder:text-ash focus:border-forensic-blue focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-ash block mb-1">{t("orgSlug")}</label>
                  <input
                    type="text"
                    value={createSlug}
                    onChange={(e) => setCreateSlug(e.target.value)}
                    placeholder={createName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "rimas-entertainment"}
                    className="w-full px-3 py-2 bg-graphite border border-slate rounded-md text-sm text-bone placeholder:text-ash focus:border-forensic-blue focus:outline-none font-mono"
                  />
                </div>
                {error && <p className="text-xs text-signal-red">{error}</p>}
                <Button className="w-full" onClick={handleCreate} disabled={actionLoading || !createName.trim()}>
                  {actionLoading && <Loader2 size={14} className="animate-spin" />}
                  {t("createButton")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Org exists — Management ─────────────────────────────────
  const isOwner = orgData.userRole === "owner";
  const isAdmin = orgData.userRole === "admin" || isOwner;
  const nonOwnerMembers = orgData.members.filter((m) => m.role !== "owner");

  return (
    <>
      <Header title={orgData.organization.name} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          {/* Org Info Card */}
          <div className="bg-carbon border border-slate rounded-lg p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Building size={18} className="text-evidence-gold" />
                  <h2 className="text-lg font-semibold text-bone">{orgData.organization.name}</h2>
                </div>
                <p className="text-xs text-ash font-mono">/{orgData.organization.slug}</p>
              </div>
              <Badge variant="default">{orgData.organization.plan_tier}</Badge>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-graphite rounded-md p-3 text-center">
                <p className="text-lg font-semibold text-bone">{orgData.stats.members}</p>
                <p className="text-[10px] text-ash">{t("statsMembers")}</p>
              </div>
              <div className="bg-graphite rounded-md p-3 text-center">
                <p className="text-lg font-semibold text-bone">{orgData.stats.catalogs}</p>
                <p className="text-[10px] text-ash">{t("statsCatalogs")}</p>
              </div>
              <div className="bg-graphite rounded-md p-3 text-center">
                <p className="text-lg font-semibold text-bone">{orgData.stats.analyses}</p>
                <p className="text-[10px] text-ash">{t("statsAnalyses")}</p>
              </div>
            </div>
          </div>

          {/* Members */}
          <div className="bg-carbon border border-slate rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate/50">
              <h3 className="text-sm font-medium text-bone">{t("teamMembers")}</h3>
              {isAdmin && (
                <Button size="sm" onClick={() => setShowInvite(true)}>
                  <UserPlus size={14} />
                  {t("inviteMember")}
                </Button>
              )}
            </div>

            <div className="divide-y divide-slate/20">
              {orgData.members.map((member) => {
                const RoleIcon = ROLE_ICONS[member.role];
                const roleColor = ROLE_COLORS[member.role];
                return (
                  <div key={member.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-graphite flex items-center justify-center text-xs font-medium text-bone">
                        {(member.display_name || member.email)?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div>
                        <p className="text-sm text-bone">
                          {member.display_name || member.email}
                        </p>
                        <p className="text-[10px] text-ash">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("flex items-center gap-1 text-xs font-medium", roleColor)}>
                        <RoleIcon size={12} />
                        {t(`roles.${member.role}`)}
                      </span>

                      {/* Role dropdown — owner only, not on self, not on owner */}
                      {isOwner && member.user_id !== profile?.id && member.role !== "owner" && (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value as "member" | "admin")}
                          className="px-2 py-1 bg-graphite border border-slate rounded text-[10px] text-bone focus:outline-none"
                        >
                          <option value="member">{t("roles.member")}</option>
                          <option value="admin">{t("roles.admin")}</option>
                        </select>
                      )}

                      {/* Remove — admin/owner, not on owner */}
                      {isAdmin && member.role !== "owner" && member.user_id !== profile?.id && (
                        <button
                          onClick={() => handleRemove(member.id)}
                          className="text-ash hover:text-signal-red transition-colors p-1"
                          title={t("removeMember")}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* API Keys — Admin/Owner */}
          {isAdmin && orgId && (
            <ApiKeysSection orgId={orgId} />
          )}

          {/* Compliance Audit Export — Admin/Owner */}
          {isAdmin && orgId && (
            <AuditExportSection orgId={orgId} />
          )}

          {/* Danger Zone — Owner only */}
          {isOwner && (
            <div className="bg-carbon border border-signal-red/30 rounded-lg p-5">
              <h3 className="text-sm font-medium text-signal-red mb-3">{t("dangerZone")}</h3>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTransfer(true)}
                >
                  <ArrowRightLeft size={14} />
                  {t("transferOwnership")}
                </Button>
              </div>
            </div>
          )}

          {/* Invite Dialog */}
          {showInvite && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="bg-carbon border border-slate rounded-lg p-6 w-full max-w-md mx-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-bone">{t("inviteTitle")}</h3>
                  <button onClick={() => { setShowInvite(false); setError(null); }} className="text-ash hover:text-bone">
                    <X size={18} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-ash block mb-1">{t("inviteEmail")}</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="team@example.com"
                      className="w-full px-3 py-2 bg-graphite border border-slate rounded-md text-sm text-bone placeholder:text-ash focus:border-forensic-blue focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-xs text-ash block mb-1">{t("inviteRole")}</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}
                      className="w-full px-3 py-2 bg-graphite border border-slate rounded-md text-sm text-bone focus:border-forensic-blue focus:outline-none"
                    >
                      <option value="member">{t("roles.member")}</option>
                      <option value="admin">{t("roles.admin")}</option>
                    </select>
                  </div>
                  {error && <p className="text-xs text-signal-red">{error}</p>}
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => { setShowInvite(false); setError(null); }}>
                      {tCommon("cancel")}
                    </Button>
                    <Button className="flex-1" onClick={handleInvite} disabled={actionLoading || !inviteEmail.trim()}>
                      {actionLoading && <Loader2 size={14} className="animate-spin" />}
                      {t("sendInvite")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Transfer Dialog */}
          {showTransfer && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="bg-carbon border border-slate rounded-lg p-6 w-full max-w-md mx-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-signal-red">{t("transferOwnership")}</h3>
                  <button onClick={() => { setShowTransfer(false); setError(null); }} className="text-ash hover:text-bone">
                    <X size={18} />
                  </button>
                </div>
                <p className="text-sm text-ash mb-4">{t("transferWarning")}</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-ash block mb-1">{t("transferTo")}</label>
                    <select
                      value={transferTarget}
                      onChange={(e) => setTransferTarget(e.target.value)}
                      className="w-full px-3 py-2 bg-graphite border border-slate rounded-md text-sm text-bone focus:border-forensic-blue focus:outline-none"
                    >
                      <option value="">{t("selectMember")}</option>
                      {nonOwnerMembers.map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.display_name || m.email} ({t(`roles.${m.role}`)})
                        </option>
                      ))}
                    </select>
                  </div>
                  {error && <p className="text-xs text-signal-red">{error}</p>}
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => { setShowTransfer(false); setError(null); }}>
                      {tCommon("cancel")}
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={handleTransfer}
                      disabled={actionLoading || !transferTarget}
                    >
                      {actionLoading && <Loader2 size={14} className="animate-spin" />}
                      {t("confirmTransfer")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────
// API Keys Section
// ────────────────────────────────────────────────────────────────

function ApiKeysSection({ orgId }: { orgId: string }) {
  const t = useTranslations("apiKeys");
  const [keys, setKeys] = useState<Array<{
    id: string;
    key_prefix: string;
    name: string;
    permissions: string[];
    is_active: boolean;
    last_used_at: string | null;
    total_requests: number;
    created_at: string;
    expires_at: string | null;
    revoked_at: string | null;
  }>>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPerms, setNewKeyPerms] = useState<string[]>(["analyze"]);
  const [newKeyExpiry, setNewKeyExpiry] = useState<string>("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchKeys = useCallback(async () => {
    const res = await fetch(`/api/organizations/${orgId}/api-keys`);
    if (res.ok) {
      const data = await res.json();
      setKeys(data.keys ?? []);
    }
  }, [orgId]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName.trim(),
          permissions: newKeyPerms,
          expires_in_days: newKeyExpiry ? parseInt(newKeyExpiry) : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedKey(data.key.full_key);
        setNewKeyName("");
        setNewKeyPerms(["analyze"]);
        setNewKeyExpiry("");
        await fetchKeys();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!confirm(t("revokeConfirm"))) return;
    await fetch(`/api/organizations/${orgId}/api-keys/${keyId}`, { method: "DELETE" });
    await fetchKeys();
  };

  const handleRotate = async (keyId: string) => {
    if (!confirm(t("rotateConfirm"))) return;
    const res = await fetch(`/api/organizations/${orgId}/api-keys/${keyId}/rotate`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setCreatedKey(data.key.full_key);
      await fetchKeys();
    }
  };

  const copyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const PERMS = ["analyze", "catalogs", "reports", "forensic", "verify", "admin"];
  const activeKeys = keys.filter((k) => k.is_active);
  const revokedKeys = keys.filter((k) => !k.is_active);

  return (
    <div className="bg-carbon border border-slate rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate/50">
        <h3 className="text-sm font-medium text-bone">{t("title")}</h3>
        <Button size="sm" onClick={() => { setShowCreate(true); setCreatedKey(null); }}>
          <Plus size={14} />
          {t("createKey")}
        </Button>
      </div>

      {/* Created key banner (shown once) */}
      {createdKey && (
        <div className="mx-4 mt-3 p-3 bg-evidence-gold/10 border border-evidence-gold/30 rounded-lg">
          <p className="text-xs text-evidence-gold font-medium mb-1">{t("copyWarning")}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[10px] font-mono text-bone bg-graphite px-2 py-1 rounded truncate">
              {createdKey}
            </code>
            <Button size="sm" variant="outline" onClick={copyKey}>
              {copied ? t("copied") : t("copy")}
            </Button>
          </div>
        </div>
      )}

      {/* Active keys */}
      {activeKeys.length === 0 && !showCreate && (
        <p className="px-5 py-6 text-sm text-ash text-center">{t("noKeys")}</p>
      )}

      {activeKeys.length > 0 && (
        <div className="divide-y divide-slate/20">
          {activeKeys.map((key) => (
            <div key={key.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm text-bone">{key.name}</p>
                <p className="text-[10px] text-ash font-mono">{key.key_prefix}...  ·  {key.permissions.join(", ")}</p>
                <p className="text-[10px] text-ash">
                  {key.total_requests.toLocaleString()} requests
                  {key.last_used_at && ` · Last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleRotate(key.id)}
                  className="px-2 py-1 text-[10px] text-ash hover:text-bone border border-slate rounded transition-colors"
                >
                  {t("rotate")}
                </button>
                <button
                  onClick={() => handleRevoke(key.id)}
                  className="px-2 py-1 text-[10px] text-signal-red hover:bg-signal-red/10 border border-slate rounded transition-colors"
                >
                  {t("revoke")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      {showCreate && !createdKey && (
        <div className="px-5 py-4 border-t border-slate/30">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-ash block mb-1">{t("keyName")}</label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder={t("keyNamePlaceholder")}
                className="w-full px-3 py-2 bg-graphite border border-slate rounded-md text-sm text-bone placeholder:text-ash focus:border-forensic-blue focus:outline-none"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-ash block mb-1">{t("permissions")}</label>
              <div className="flex flex-wrap gap-2">
                {PERMS.map((perm) => (
                  <label key={perm} className="flex items-center gap-1 text-[10px] text-ash cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newKeyPerms.includes(perm)}
                      onChange={(e) =>
                        setNewKeyPerms(
                          e.target.checked
                            ? [...newKeyPerms, perm]
                            : newKeyPerms.filter((p) => p !== perm),
                        )
                      }
                      className="w-3 h-3 rounded accent-forensic-blue"
                    />
                    {perm}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-ash block mb-1">{t("expiration")}</label>
              <select
                value={newKeyExpiry}
                onChange={(e) => setNewKeyExpiry(e.target.value)}
                className="w-full px-3 py-2 bg-graphite border border-slate rounded-md text-sm text-bone focus:outline-none"
              >
                <option value="">{t("noExpiration")}</option>
                <option value="30">30 {t("days")}</option>
                <option value="90">90 {t("days")}</option>
                <option value="365">1 {t("year")}</option>
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
                {useTranslations("common")("cancel")}
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={creating || !newKeyName.trim()}>
                {creating && <Loader2 size={14} className="animate-spin" />}
                {t("generate")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Audit Export Section
// ────────────────────────────────────────────────────────────────

function AuditExportSection({ orgId }: { orgId: string }) {
  const t = useTranslations("auditExport");
  const [dateFrom, setDateFrom] = useState(
    new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0],
  );
  const [dateTo, setDateTo] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/audit-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: orgId,
          date_from: dateFrom,
          date_to: dateTo,
          format,
        }),
      });

      if (!res.ok) return;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `probatio-audit-${dateFrom}-to-${dateTo}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-carbon border border-slate rounded-lg p-5">
      <h3 className="text-sm font-medium text-bone mb-3">{t("title")}</h3>
      <p className="text-xs text-ash mb-4">{t("description")}</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="text-[10px] text-ash block mb-1">{t("from")}</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-2 py-1.5 bg-graphite border border-slate rounded text-xs text-bone focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] text-ash block mb-1">{t("to")}</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full px-2 py-1.5 bg-graphite border border-slate rounded text-xs text-bone focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] text-ash block mb-1">{t("format")}</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as "json" | "csv")}
            className="w-full px-2 py-1.5 bg-graphite border border-slate rounded text-xs text-bone focus:outline-none"
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button size="sm" onClick={handleExport} disabled={exporting} className="w-full">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {t("download")}
          </Button>
        </div>
      </div>
    </div>
  );
}
