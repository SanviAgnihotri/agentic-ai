import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { CheckCircle2, CreditCard, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ManageBillingButton } from "@/components/billing/manage-billing-button";
import { getDb, schema } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { dodoEnabled, getDodo } from "@/lib/dodo";
import { FREE_USAGE_CREDITS, PRO_USAGE_CREDITS } from "@/lib/plans";

export const metadata: Metadata = { title: "Billing" };

/** Dodo subscription statuses are snake_case — render them human. */
const STATUS_LABELS: Record<string, string> = {
  on_hold: "On hold",
  canceled: "Cancelled",
  cancelled: "Cancelled",
  trialing: "Trialing",
  active: "Active",
  expired: "Expired",
  failed: "Failed",
  paused: "Paused",
  pending: "Pending",
};

function statusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return (
    STATUS_LABELS[status] ??
    status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const { checkout } = await searchParams;

  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, user.email))
    .limit(1);
  const row = rows[0];

  const isPro = row?.plan === "pro";
  const credits = row?.usageCredits ?? FREE_USAGE_CREDITS;
  const total = isPro ? PRO_USAGE_CREDITS : FREE_USAGE_CREDITS;
  const percent = Math.max(0, Math.min(100, Math.round((credits / total) * 100)));

  // Subscription detail is best-effort — the webhook-synced row is the source
  // of truth for access, this is just display.
  let nextBilling: string | null = null;
  if (dodoEnabled() && row?.dodoSubscriptionId) {
    try {
      const subscription = (await getDodo().subscriptions.retrieve(
        row.dodoSubscriptionId,
      )) as unknown as { next_billing_date?: string | null };
      nextBilling = subscription.next_billing_date ?? null;
    } catch (error) {
      console.warn("[billing] subscription lookup failed", error);
    }
  }

  const status = row?.subscriptionStatus ?? (isPro ? "active" : null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
          <p className="text-sm text-muted-foreground">
            Your plan, usage credits and subscription — powered by Dodo Payments.
          </p>
        </div>
        {!isPro ? (
          <Button asChild>
            <Link href="/pricing">
              <Sparkles className="size-4" />
              Upgrade to Pro
            </Link>
          </Button>
        ) : null}
      </div>

      {checkout === "success" ? (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="text-sm">
            <p className="font-medium">Checkout complete</p>
            <p className="mt-0.5 text-muted-foreground">
              Pro access activates as soon as Dodo confirms the payment — usually a
              few seconds. Refresh this page if your plan still shows as Free.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="size-4 text-muted-foreground" />
              Current plan
              {isPro ? <Badge>Pro</Badge> : <Badge variant="secondary">Free</Badge>}
            </CardTitle>
            <CardDescription>
              {isPro
                ? "Live autonomous runs, 2,000 usage credits per month and priority support."
                : "Demo-mode execution, 3 agents and 200 usage credits per month."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="mt-0.5 font-medium">{statusLabel(status)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {isPro ? "Next payment" : "Billing"}
                </dt>
                <dd className="mt-0.5 font-medium">
                  {isPro
                    ? nextBilling
                      ? new Date(nextBilling).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"
                    : "No payment method"}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              {row?.dodoCustomerId ? (
                <ManageBillingButton variant={isPro ? "default" : "outline"} />
              ) : null}
              {!isPro ? (
                <Button variant="outline" asChild>
                  <Link href="/pricing">View plans</Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" />
              Usage credits
            </CardTitle>
            <CardDescription>
              Each tool call an agent makes uses one credit. Resets on your plan
              renewal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium tabular-nums">
                {credits.toLocaleString("en")} / {total.toLocaleString("en")}
              </span>
              <span className="tabular-nums text-muted-foreground">{percent}% left</span>
            </div>
            <Progress
              value={percent}
              aria-label={`Usage credits: ${percent}% left`}
              className="h-2"
            />
            {!isPro ? (
              <p className="text-sm text-muted-foreground">
                Pro includes 2,000 credits per month — 10× the free allowance.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Invoices, payment methods, plan changes and cancellations are handled in the
        secure Dodo Payments portal.
      </p>
    </div>
  );
}
