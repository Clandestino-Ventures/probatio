"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { toast } from "sonner";

interface CheckoutButtonProps {
  plan: "starter" | "professional";
  currentPlan?: string;
  variant?: "primary" | "outline" | "gold";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  className?: string;
}

export function CheckoutButton({
  plan,
  currentPlan,
  variant = "primary",
  size = "md",
  children,
  className,
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const isCurrentPlan = currentPlan === plan;
  const isDowngrade =
    currentPlan === "professional" && plan === "starter";

  async function handleCheckout() {
    if (isCurrentPlan) return;

    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Checkout failed");
      }

      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start checkout");
      setLoading(false);
    }
  }

  if (isCurrentPlan) {
    return (
      <Button variant="outline" size={size} disabled className={className}>
        Current Plan
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleCheckout}
      loading={loading}
      className={className}
    >
      {isDowngrade ? "Downgrade" : children}
    </Button>
  );
}
