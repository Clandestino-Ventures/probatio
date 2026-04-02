"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface DashboardAnalysis {
  id: string;
  file_name: string;
  title: string;
  status: string;
  current_step: string | null;
  progress_pct: number;
  overall_risk: string | null;
  overall_score: number | null;
  match_count: number;
  mode: string;
  created_at: string;
  updated_at: string;
  error_message: string | null;
}

interface DashboardRealtimeState {
  activeAnalyses: DashboardAnalysis[];
  attentionAnalyses: DashboardAnalysis[];
  recentAnalyses: DashboardAnalysis[];
  activeCount: number;
  attentionCount: number;
}

export function useDashboardRealtime(
  initialActive: DashboardAnalysis[],
  initialAttention: DashboardAnalysis[],
  initialRecent: DashboardAnalysis[],
): DashboardRealtimeState {
  const [active, setActive] = useState(initialActive);
  const [attention, setAttention] = useState(initialAttention);
  const [recent, setRecent] = useState(initialRecent);

  useEffect(() => {
    const supabase = createClient();

    // Get current user ID for filtering
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      const channel = supabase
        .channel("dashboard-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "analyses",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const row = payload.new as DashboardAnalysis;
            const eventType = payload.eventType;

            if (eventType === "INSERT") {
              // New analysis — add to active
              setActive((prev) => [row, ...prev]);
            } else if (eventType === "UPDATE") {
              const isCompleted = row.status === "completed";
              const isFailed = row.status === "failed";
              const isHighRisk = row.overall_risk === "high" || row.overall_risk === "critical";

              if (isCompleted || isFailed) {
                // Remove from active
                setActive((prev) => prev.filter((a) => a.id !== row.id));

                if (isCompleted && isHighRisk) {
                  // Add to attention
                  setAttention((prev) => [row, ...prev]);
                }
                // Add to recent (top)
                setRecent((prev) => [row, ...prev.filter((a) => a.id !== row.id).slice(0, 19)]);
              } else {
                // Still in progress — update in active list
                setActive((prev) =>
                  prev.map((a) => (a.id === row.id ? { ...a, ...row } : a))
                );
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    });
  }, []);

  return {
    activeAnalyses: active,
    attentionAnalyses: attention,
    recentAnalyses: recent,
    activeCount: active.length,
    attentionCount: attention.length,
  };
}
