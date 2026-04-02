"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import {
  Users,
  BarChart3,
  Activity,
  Database,
  Scale,
  Shield,
  Download,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui";

interface Metrics {
  users: { total: number; active_30d: number; paying: number; enterprise: number };
  analyses: { total: number; this_month: number; by_mode: { screening: number; clearance: number; forensic: number } };
  revenue: { mrr: number; arr_estimate: number };
  catalogs: { total: number; total_tracks: number; tracks_with_embeddings: number };
  forensic: { total_cases: number; active_cases: number };
  pipeline: { success_rate: number; failed_this_week: number };
  platform: { total_reference_tracks: number; total_custody_entries: number };
}

interface PipelineStat {
  mode: string;
  total: number;
  completed: number;
  failed: number;
  success_rate: number;
  failed_this_week: number;
}

interface RecentFailure {
  id: string;
  file_name: string;
  mode: string;
  error_message: string | null;
  created_at: string;
}

function KpiCard({ label, value, icon: Icon, color = "text-bone" }: {
  label: string;
  value: string | number;
  icon: typeof Users;
  color?: string;
}) {
  return (
    <div className="bg-carbon border border-slate rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className="text-ash" />
        <span className="text-[10px] text-ash uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-display font-semibold ${color}`}>{value}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [pipelines, setPipelines] = useState<PipelineStat[]>([]);
  const [failures, setFailures] = useState<RecentFailure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [metricsRes, pipelineRes] = await Promise.all([
        fetch("/api/admin/metrics"),
        fetch("/api/admin/pipeline"),
      ]);

      if (metricsRes.status === 403 || pipelineRes.status === 403) {
        setError("Admin access required");
        return;
      }

      if (metricsRes.ok) setMetrics(await metricsRes.json());
      if (pipelineRes.ok) {
        const pData = await pipelineRes.json();
        setPipelines(pData.pipelines ?? []);
        setFailures(pData.recent_failures ?? []);
      }
    } catch {
      setError("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Loader2 size={24} className="animate-spin text-forensic-blue" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
        <Shield size={48} className="text-signal-red" />
        <p className="text-ash">{error}</p>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-bone">PROBATIO Admin</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const from = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
            const to = new Date().toISOString().split("T")[0];
            window.open(
              `/api/admin/audit-export`,
              "_blank",
            );
          }}
        >
          <Download size={14} />
          Export Audit
        </Button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Total Users" value={metrics.users.total} icon={Users} />
        <KpiCard label="Paying" value={metrics.users.paying} icon={Users} color="text-risk-low" />
        <KpiCard label="MRR" value={`$${metrics.revenue.mrr.toLocaleString()}`} icon={BarChart3} color="text-evidence-gold" />
        <KpiCard label="Analyses" value={metrics.analyses.total.toLocaleString()} icon={Activity} />
        <KpiCard label="This Month" value={metrics.analyses.this_month} icon={Activity} color="text-forensic-blue" />
        <KpiCard label="Pipeline" value={`${metrics.pipeline.success_rate}%`} icon={Activity} color={metrics.pipeline.success_rate >= 95 ? "text-risk-low" : "text-signal-red"} />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Enterprise Users" value={metrics.users.enterprise} icon={Shield} />
        <KpiCard label="Catalogs" value={metrics.catalogs.total} icon={Database} />
        <KpiCard label="Ref Tracks" value={metrics.catalogs.total_tracks.toLocaleString()} icon={Database} />
        <KpiCard label="Forensic Cases" value={`${metrics.forensic.active_cases} active`} icon={Scale} />
      </div>

      {/* Analysis Mode Breakdown */}
      <div className="bg-carbon border border-slate rounded-lg p-5">
        <h3 className="text-sm font-medium text-bone mb-3">Analysis by Mode</h3>
        <div className="grid grid-cols-3 gap-4">
          {(["screening", "clearance", "forensic"] as const).map((mode) => (
            <div key={mode} className="text-center">
              <p className="text-xl font-semibold text-bone">
                {metrics.analyses.by_mode[mode].toLocaleString()}
              </p>
              <p className="text-[10px] text-ash capitalize">{mode}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline Health */}
      <div className="bg-carbon border border-slate rounded-lg p-5">
        <h3 className="text-sm font-medium text-bone mb-3">Pipeline Health</h3>
        <div className="space-y-2">
          {pipelines.map((p) => (
            <div key={p.mode} className="flex items-center justify-between py-2 border-b border-slate/20 last:border-0">
              <span className="text-sm text-bone capitalize">{p.mode}</span>
              <div className="flex items-center gap-4 text-xs">
                <span className={p.success_rate >= 95 ? "text-risk-low" : "text-signal-red"}>
                  {p.success_rate}% success
                </span>
                <span className="text-ash">{p.total} total</span>
                {p.failed_this_week > 0 && (
                  <span className="text-signal-red">{p.failed_this_week} failed this week</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Failures */}
      {failures.length > 0 && (
        <div className="bg-carbon border border-signal-red/30 rounded-lg p-5">
          <h3 className="text-sm font-medium text-signal-red mb-3 flex items-center gap-2">
            <AlertTriangle size={14} />
            Recent Failures
          </h3>
          <div className="space-y-2">
            {failures.slice(0, 5).map((f) => (
              <div key={f.id} className="flex items-center justify-between text-xs py-1">
                <span className="text-bone truncate max-w-[200px]">{f.file_name}</span>
                <span className="text-ash capitalize">{f.mode}</span>
                <span className="text-ash">{new Date(f.created_at).toLocaleDateString()}</span>
                <span className="text-signal-red truncate max-w-[200px]">
                  {f.error_message ?? "Unknown error"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue */}
      <div className="bg-carbon border border-slate rounded-lg p-5">
        <h3 className="text-sm font-medium text-bone mb-3">Revenue</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-3xl font-display font-bold text-evidence-gold">
              ${metrics.revenue.mrr.toLocaleString()}
            </p>
            <p className="text-xs text-ash">Monthly Recurring Revenue</p>
          </div>
          <div>
            <p className="text-3xl font-display font-bold text-bone">
              ${metrics.revenue.arr_estimate.toLocaleString()}
            </p>
            <p className="text-xs text-ash">ARR Estimate</p>
          </div>
        </div>
      </div>
    </div>
  );
}
