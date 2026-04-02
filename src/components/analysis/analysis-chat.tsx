"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Badge, Button } from "@/components/ui";
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  AlertTriangle,
  BookOpen,
  Clock,
  Sparkles,
  Lock,
} from "lucide-react";
import type { QACitation } from "@/lib/ai/analysis-qa";
import type { AnalysisQAContext } from "@/lib/ai/analysis-qa";
import { getSuggestedQuestions } from "@/lib/ai/suggested-questions";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: QACitation[];
  suggestedFollowUps?: string[];
  timestamp: string;
}

interface AnalysisChatProps {
  analysisId: string;
  context: AnalysisQAContext;
  planTier: "free" | "starter" | "professional" | "enterprise";
}

// ────────────────────────────────────────────────────────────────────────────
// Citation Badge
// ────────────────────────────────────────────────────────────────────────────

const CITATION_ICONS: Record<QACitation["type"], typeof BookOpen> = {
  evidence: Clock,
  score: Sparkles,
  precedent: BookOpen,
  methodology: BookOpen,
};

const CITATION_COLORS: Record<QACitation["type"], string> = {
  evidence: "text-forensic-blue bg-forensic-blue/10 border-forensic-blue/20",
  score: "text-evidence-gold bg-evidence-gold/10 border-evidence-gold/20",
  precedent: "text-risk-moderate bg-risk-moderate/10 border-risk-moderate/20",
  methodology: "text-ash bg-graphite border-slate",
};

function CitationBadge({ citation }: { citation: QACitation }) {
  const Icon = CITATION_ICONS[citation.type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border",
        CITATION_COLORS[citation.type]
      )}
    >
      <Icon size={10} />
      {citation.reference}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function AnalysisChat({
  analysisId,
  context,
  planTier,
}: AnalysisChatProps) {
  const t = useTranslations("analysisChat");
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isPro = planTier === "professional" || planTier === "enterprise";
  const suggestedQuestions = getSuggestedQuestions(context);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open && isPro && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open, isPro]);

  const sendMessage = useCallback(
    async (question: string) => {
      if (!question.trim() || loading) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: question.trim(),
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);
      setError(null);

      try {
        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        }));

        const res = await fetch(`/api/analyses/${analysisId}/ask`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: question.trim(),
            conversationHistory: history,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.error ?? `Request failed (${res.status})`
          );
        }

        const data = await res.json();

        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.answer,
          citations: data.citations,
          suggestedFollowUps: data.suggestedFollowUps,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to get response"
        );
      } finally {
        setLoading(false);
      }
    },
    [analysisId, loading, messages]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all",
          "bg-forensic-blue text-white hover:bg-forensic-blue/90",
          "md:bottom-8 md:right-8",
          open && "hidden"
        )}
      >
        <MessageSquare size={18} />
        <span className="text-sm font-medium">{t("fab")}</span>
      </button>

      {/* Backdrop (mobile) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-obsidian/60 md:bg-transparent md:pointer-events-none"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Chat Panel */}
      <div
        className={cn(
          "fixed z-50 bg-carbon border-l border-slate flex flex-col transition-transform duration-300 ease-in-out",
          // Mobile: full screen bottom sheet
          "inset-x-0 bottom-0 top-16 md:top-0 md:inset-x-auto md:right-0 md:w-[420px]",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-forensic-blue" />
            <span className="text-sm font-semibold text-bone">
              {t("title")}
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-md hover:bg-graphite text-ash hover:text-bone transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Plan Gate */}
        {!isPro ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
            <Lock size={32} className="text-ash" />
            <p className="text-sm text-bone text-center font-medium">
              {t("planGate.title")}
            </p>
            <p className="text-xs text-ash text-center">
              {t("planGate.description")}
            </p>
            <Button variant="primary" size="sm">
              {t("planGate.upgrade")}
            </Button>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
            >
              {/* Welcome message if no messages */}
              {messages.length === 0 && (
                <div className="bg-graphite/50 border border-slate rounded-md p-4">
                  <p className="text-sm text-bone mb-3">
                    {t("welcome")}
                  </p>
                  <div className="space-y-2">
                    {suggestedQuestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(q)}
                        className="block w-full text-left text-xs text-forensic-blue hover:text-forensic-blue/80 hover:bg-graphite px-2 py-1.5 rounded transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat messages */}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col gap-1",
                    msg.role === "user" ? "items-end" : "items-start"
                  )}
                >
                  {/* Role label */}
                  <span className="text-[10px] text-ash uppercase tracking-wider px-1">
                    {msg.role === "user" ? t("you") : "Probatio"}
                  </span>

                  {/* Message bubble */}
                  <div
                    className={cn(
                      "rounded-lg px-3 py-2.5 max-w-[90%] text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-forensic-blue/15 text-bone border border-forensic-blue/20"
                        : "bg-graphite text-ash border border-slate"
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5 [&_strong]:text-bone">
                        {msg.content.split("\n").map((line, i) => {
                          if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
                            return (
                              <div key={i} className="flex gap-1.5 ml-1">
                                <span className="text-forensic-blue shrink-0 mt-0.5">&#8226;</span>
                                <span>{line.trim().slice(2)}</span>
                              </div>
                            );
                          }
                          if (line.trim() === "") return <div key={i} className="h-2" />;
                          return <p key={i} className="my-0.5">{line}</p>;
                        })}
                      </div>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>

                  {/* Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="flex flex-wrap gap-1 px-1 max-w-[90%]">
                      {msg.citations.slice(0, 6).map((c, i) => (
                        <CitationBadge key={i} citation={c} />
                      ))}
                    </div>
                  )}

                  {/* Follow-up suggestions */}
                  {msg.suggestedFollowUps &&
                    msg.suggestedFollowUps.length > 0 && (
                      <div className="space-y-1 mt-1 max-w-[90%]">
                        {msg.suggestedFollowUps.map((q, i) => (
                          <button
                            key={i}
                            onClick={() => sendMessage(q)}
                            disabled={loading}
                            className="block text-left text-xs text-forensic-blue hover:text-forensic-blue/80 hover:bg-graphite px-2 py-1 rounded transition-colors disabled:opacity-50"
                          >
                            &rarr; {q}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              ))}

              {/* Loading */}
              {loading && (
                <div className="flex items-start gap-2">
                  <div className="bg-graphite border border-slate rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-2 text-sm text-ash">
                      <Loader2 size={14} className="animate-spin text-forensic-blue" />
                      {t("analyzing")}
                    </div>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2">
                  <div className="bg-signal-red/5 border border-signal-red/20 rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-2 text-sm text-signal-red">
                      <AlertTriangle size={14} />
                      {error}
                    </div>
                    <button
                      onClick={() => {
                        setError(null);
                        const lastUser = [...messages]
                          .reverse()
                          .find((m) => m.role === "user");
                        if (lastUser) sendMessage(lastUser.content);
                      }}
                      className="text-xs text-signal-red hover:underline mt-1"
                    >
                      {t("retry")}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="shrink-0 border-t border-slate px-4 py-3"
            >
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("placeholder")}
                  rows={1}
                  disabled={loading}
                  className="flex-1 resize-none bg-graphite border border-slate rounded-md px-3 py-2 text-sm text-bone placeholder:text-ash focus:outline-none focus:border-forensic-blue disabled:opacity-50 max-h-24"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={loading || !input.trim()}
                >
                  <Send size={14} />
                </Button>
              </div>
              <p className="text-[10px] text-ash mt-2">
                {t("poweredBy")}
              </p>
            </form>
          </>
        )}
      </div>
    </>
  );
}
