import Image from "next/image";
import Link from "next/link";
import {
  Blocks,
  Bot,
  Compass,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PricingPlans } from "@/components/billing/pricing-plans";
import { getSessionUser } from "@/lib/auth";
import { dodoEnabled } from "@/lib/dodo";
import { PRO_TRIAL_DAYS } from "@/lib/plans";

export const metadata = {
  title: "Pricing",
  description:
    "Start free. Upgrade to Pro for live autonomous agent runs, a bigger credit budget and priority support.",
};

const CAPABILITIES = [
  {
    icon: Bot,
    title: "Autonomous execution",
    description:
      "A step-by-step tool-calling loop that plans, acts, adapts and writes the final deliverable.",
  },
  {
    icon: Blocks,
    title: "29 integrations",
    description:
      "Gmail, Slack, Notion, Google Docs, GitHub, Linear, Stripe and more — connected in a click.",
  },
  {
    icon: Compass,
    title: "Browser automation",
    description:
      "Live website research and monitoring, so agents can read pricing pages, dashboards and search results.",
  },
];

const FAQ = [
  {
    question: "What counts as a usage credit?",
    answer:
      "Every tool call an agent makes uses one credit. Free includes 200 credits per month; Pro includes 2,000.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes — manage or cancel your subscription from the billing portal. Access continues until the end of the period you paid for.",
  },
  {
    question: "Who processes payments?",
    answer:
      "Dodo Payments acts as the Merchant of Record, so taxes and receipts are handled for you. Cards, UPI and local payment methods are supported globally.",
  },
  {
    question: "What happens after the trial?",
    answer: `Your payment method is charged automatically at the end of the ${PRO_TRIAL_DAYS}-day trial. Cancel before it ends and you pay nothing.`,
  },
];

export default async function PricingPage() {
  const user = await getSessionUser();
  const billingReady = dodoEnabled();

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      {/* Ambient background — one accent glow, low alpha */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-56 left-1/2 h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-primary/6 blur-[120px]" />
      </div>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.svg" alt="Groovy AI" width={28} height={28} />
          <span className="text-sm font-semibold tracking-tight">Groovy AI</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/">Home</Link>
          </Button>
          {user ? (
            <Button size="sm" asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/sign-in">Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-24">
        {/* Hero */}
        <section className="mx-auto max-w-3xl pt-12 text-center sm:pt-16">
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {PRO_TRIAL_DAYS}-day free trial · Cancel anytime
          </Badge>
          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-[-0.022em] sm:text-5xl lg:text-6xl">
            Pricing that scales with your agents
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
            Build and test for free. Go Pro when you want your agents to run live —
            researching, writing and reporting while you sleep.
          </p>
        </section>

        <PricingPlans
          currentPlan={user?.plan ?? null}
          signedIn={Boolean(user)}
          billingReady={billingReady}
        />

        {!billingReady ? (
          <p className="mt-6 text-center text-sm text-amber-600 dark:text-amber-400">
            Billing is not configured in this environment yet — add your Dodo Payments
            keys to enable checkout.
          </p>
        ) : null}

        {/* Trust strip */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" />
            Secure checkout by Dodo Payments
          </span>
          <span className="inline-flex items-center gap-1.5">
            <RefreshCcw className="size-3.5" />
            Cancel anytime
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Blocks className="size-3.5" />
            Taxes handled for you
          </span>
        </div>

        {/* Capabilities */}
        <section className="mt-24">
          <h2 className="text-center text-2xl font-semibold tracking-tight">
            Everything your agents need
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Pro unlocks the full autonomous stack.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((capability) => (
              <div
                key={capability.title}
                className="rounded-xl border border-border/60 bg-card/50 p-6 backdrop-blur-sm"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                  <capability.icon className="size-5 text-primary" />
                </div>
                <h3 className="mt-4 text-sm font-semibold tracking-tight">
                  {capability.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {capability.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto mt-24 max-w-3xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight">
            Questions, answered
          </h2>
          <div className="mt-8 divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm">
            {FAQ.map((item) => (
              <div key={item.question} className="p-6">
                <dt className="text-sm font-medium">{item.question}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </dd>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground sm:flex-row">
          <span className="inline-flex items-center gap-2">
            <Image src="/logo.svg" alt="" width={20} height={20} />
            Groovy AI
          </span>
          <span className="flex items-center gap-5">
            <Link href="/dashboard" className="transition-colors hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/sign-in" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
            <span>© {new Date().getFullYear()} Groovy AI</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
