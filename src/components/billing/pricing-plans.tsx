"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/hooks/use-poll";
import {
  CHECKOUT_PLAN_IDS,
  FREE_FEATURES,
  PRO_FEATURES,
  PRO_MONTHLY_PRICE,
  PRO_TRIAL_DAYS,
  PRO_YEARLY_PRICE,
  YEARLY_SAVINGS_PERCENT,
  intervalLabel,
  priceForInterval,
  type BillingInterval,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

interface PricingPlansProps {
  currentPlan: string | null;
  signedIn: boolean;
  billingReady: boolean;
}

export function PricingPlans({ currentPlan, signedIn, billingReady }: PricingPlansProps) {
  const router = useRouter();
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [pending, setPending] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isPro = currentPlan === "pro";
  const price = priceForInterval(interval);
  const yearlySavings = PRO_MONTHLY_PRICE * 12 - PRO_YEARLY_PRICE;

  async function startCheckout() {
    setError(null);
    if (!signedIn) {
      router.push("/sign-in");
      return;
    }
    setPending("checkout");
    try {
      const data = await apiFetch<{ checkoutUrl?: string }>("/api/billing/checkout", {
        method: "POST",
        json: { planId: CHECKOUT_PLAN_IDS[interval] },
      });
      if (!data.checkoutUrl) throw new Error("Checkout URL was not returned");

      try {
        // Overlay checkout keeps the customer on the pricing page; the iframe
        // handles cards, UPI and wallets. Falls back to the hosted page if the
        // SDK cannot load.
        const { DodoPayments } = await import("dodopayments-checkout");
        DodoPayments.Initialize({
          mode: process.env.NEXT_PUBLIC_DODO_MODE === "live" ? "live" : "test",
          displayType: "overlay",
          onEvent: (event) => {
            if (event.event_type === "checkout.closed") setPending(null);
          },
        });
        DodoPayments.Checkout.open({ checkoutUrl: data.checkoutUrl });
      } catch (overlayError) {
        console.warn("Overlay checkout unavailable, using hosted page", overlayError);
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start checkout";
      toast.error(message);
      setError(message);
      setPending(null);
    }
  }

  async function openPortal() {
    setPending("portal");
    try {
      const data = await apiFetch<{ url: string }>("/api/billing/portal", { method: "POST" });
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open billing");
      setPending(null);
    }
  }

  return (
    <div className="mx-auto mt-14 max-w-4xl">
      {/* Billing interval toggle */}
      <div className="flex flex-col items-center gap-3">
        <div className="inline-flex items-center rounded-full border border-border/60 bg-card/80 p-1 backdrop-blur">
          {(["monthly", "yearly"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setInterval(value)}
              className={cn(
                "relative rounded-full px-5 py-2 text-sm font-medium capitalize transition-all",
                interval === value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value}
              {value === "yearly" ? (
                <span
                  className={cn(
                    "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    interval === value
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  −{YEARLY_SAVINGS_PERCENT}%
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {interval === "yearly"
            ? `Two months free — save $${yearlySavings} per year`
            : `Switch to yearly and save $${yearlySavings}`}
        </p>
      </div>

      {/* Cards */}
      <div className="mt-10 grid gap-5 md:grid-cols-2 md:items-stretch">
        {/* Free */}
        <section className="flex flex-col rounded-xl border border-border/60 bg-card/60 p-7 backdrop-blur-sm">
          <div className="flex min-h-6 items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">Free</h2>
            {signedIn && !isPro ? (
              <Badge variant="secondary" className="rounded-full">
                Current plan
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 min-h-10 text-sm leading-relaxed text-muted-foreground">
            Explore the workspace with demo-mode execution.
          </p>
          <div className="mt-6 flex items-end gap-1.5">
            <span className="text-5xl font-semibold tracking-tight">$0</span>
            <span className="pb-1.5 text-sm text-muted-foreground">forever</span>
          </div>
          <p className="mt-2 min-h-4 text-xs text-muted-foreground">
            No credit card required
          </p>
          <Button
            variant="outline"
            className="mt-6 h-10 w-full"
            onClick={() => router.push(signedIn ? "/dashboard" : "/sign-in")}
          >
            {signedIn ? "Open dashboard" : "Sign in"}
          </Button>
          <div className="my-6 h-px bg-border/60" />
          <ul className="space-y-3 text-sm">
            {FREE_FEATURES.map((feature) => (
              <li key={feature.label} className="flex items-start gap-3">
                <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{feature.label}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Pro */}
        <div className="relative">
          <section id="pro" className="flex h-full flex-col rounded-xl border border-primary/40 bg-card p-7">
            <div className="flex min-h-6 items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                Pro
                <Sparkles className="size-4 text-primary" />
              </h2>
              {isPro ? (
                <Badge className="rounded-full">Current plan</Badge>
              ) : (
                <Badge className="rounded-full bg-primary/15 text-primary hover:bg-primary/15">
                  Most popular
                </Badge>
              )}
            </div>
            <p className="mt-1 min-h-10 text-sm leading-relaxed text-muted-foreground">
              Live autonomous runs with a bigger credit budget.
            </p>
            <div className="mt-6 flex items-end gap-1.5">
              <span className="text-5xl font-semibold tracking-tight">${price}</span>
              <span className="pb-1.5 text-sm text-muted-foreground">
                /{intervalLabel(interval)}
              </span>
            </div>
            <p className="mt-2 min-h-4 text-xs text-muted-foreground">
              {interval === "yearly"
                ? `Billed $${PRO_YEARLY_PRICE} yearly · $${PRO_MONTHLY_PRICE}/mo equivalent`
                : `${PRO_TRIAL_DAYS}-day free trial, then $${PRO_MONTHLY_PRICE}/month`}
            </p>
            {isPro ? (
              <Button className="mt-6 h-10 w-full" onClick={openPortal} disabled={pending !== null}>
                {pending === "portal" ? <Loader2 className="size-4 animate-spin" /> : null}
                Manage billing
              </Button>
            ) : (
              <Button
                className="mt-6 h-10 w-full"
                onClick={startCheckout}
                disabled={pending !== null || !billingReady}
              >
                {pending === "checkout" ? <Loader2 className="size-4 animate-spin" /> : null}
                {billingReady ? `Start ${PRO_TRIAL_DAYS}-day free trial` : "Payments coming soon"}
              </Button>
            )}
            <div className="my-6 h-px bg-border/60" />
            <ul className="space-y-3 text-sm">
              {PRO_FEATURES.map((feature) => (
                <li key={feature.label} className="flex items-start gap-3">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{feature.label}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-6 text-center text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
