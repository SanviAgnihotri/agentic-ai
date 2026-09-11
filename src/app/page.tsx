import Image from "next/image";
import Link from "next/link";
import { agentTemplates } from "@/agent/config/templates";
import { iconFor, ToolIcon, brandSlugForToolNames } from "@/components/shared/tool-icon";
import { Button } from "@/components/ui/button";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { getSessionUser } from "@/lib/auth";

const INTEGRATIONS = [
  "Gmail",
  "Slack",
  "Google Docs",
  "Notion",
  "GitHub",
  "Reddit",
  "Calendar",
  "Browser",
  "Web search",
];

const FEATURES = [
  {
    overline: "Compose",
    title: "Plain English becomes an agent",
    body: "Describe the outcome once. Groovy asks the clarifying questions that matter, then writes the objective, instructions, tools and schedule.",
  },
  {
    overline: "Execute",
    title: "Real tools, live websites",
    body: "Gmail, Slack, Notion, GitHub and 100+ more — plus a cloud browser for the parts of the web that need visiting. Every step is logged and auditable.",
  },
  {
    overline: "Deliver",
    title: "Runs while you sleep",
    body: "Schedule daily, weekly or hourly. Results land where you work: chat, Google Docs, Slack. Pause or edit any agent at any time.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Describe the task",
    body: "“Find the top 5 trending AI topics on Reddit, summarize them to a Google Doc and notify me on Slack every day at 8am.”",
  },
  {
    number: "02",
    title: "Review the agent",
    body: "Groovy builds the objective, instructions, skills, tools and schedule — and asks when a decision is genuinely yours.",
  },
  {
    number: "03",
    title: "Connect your apps",
    body: "One-click OAuth for the tools you use. Built-in browser and search tools need no setup at all.",
  },
  {
    number: "04",
    title: "Let it run",
    body: "Run now or on schedule. Watch the execution live, step by step, and get the finished result where you work.",
  },
];

export default async function LandingPage() {
  const user = await getSessionUser();
  const primaryHref = user ? "/dashboard" : "/sign-in";

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-50 glass border-b border-border/60">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="Groovy AI" width={24} height={24} />
            <span className="text-sm font-semibold tracking-tight">Groovy AI</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <Link href="/pricing" className="transition-colors hover:text-foreground">
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-1.5">
            {user ? (
              <Button asChild size="sm" className="h-8">
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                <Button asChild size="sm" className="h-8">
                  <Link href="/sign-in">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero — type-led, the product is the imagery */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -top-40 left-1/2 h-[380px] w-[720px] -translate-x-1/2 rounded-full bg-primary/8 blur-[120px]" />
          <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-4 pt-24 pb-16 text-center sm:px-6 lg:pt-28">
            <p className="font-mono text-[11px] tracking-[0.15em] text-muted-foreground uppercase">
              The autonomous agent workspace
            </p>
            <h1 className="mt-5 max-w-3xl text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.022em] sm:text-5xl lg:text-6xl">
              Describe a task.
              <br />
              Get an agent that does it.
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-[17px]">
              Groovy AI turns plain English into autonomous agents that research the
              web, write to your docs, post to Slack and run on a schedule — while
              you focus on real work.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
              <Button asChild size="lg" className="h-9 px-4 text-[15px]">
                <Link href={primaryHref}>
                  {user ? "Open the dashboard" : "Build your first agent"}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-9 px-4 text-[15px]">
                <Link href="/sign-in">Try the live demo</Link>
              </Button>
            </div>
            <p className="mt-5 font-mono text-xs text-muted-foreground">
              No credit card · works with free AI keys
            </p>
          </div>

          {/* Product mock — the product is the imagery */}
          <FadeIn className="mx-auto w-full max-w-4xl px-4 pb-24 sm:px-6" y={10}>
            <div className="rounded-xl border border-border bg-card shadow-apple-lg">
              <div className="flex items-center gap-1.5 border-b border-border/70 px-4 py-2.5">
                <span className="size-2 rounded-full bg-foreground/15" />
                <span className="size-2 rounded-full bg-foreground/15" />
                <span className="size-2 rounded-full bg-foreground/15" />
                <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                  app.groovy.ai/dashboard
                </span>
              </div>
              <div className="grid gap-px bg-border/60 sm:grid-cols-[180px_1fr]">
                <div className="hidden bg-sidebar p-3 sm:block">
                  {["Dashboard", "Agents", "Runs", "Integrations"].map((item, index) => (
                    <div
                      key={item}
                      className={
                        index === 1
                          ? "rounded-md bg-foreground/8 px-2.5 py-1.5 text-xs text-foreground"
                          : "px-2.5 py-1.5 text-xs text-muted-foreground"
                      }
                    >
                      {item}
                    </div>
                  ))}
                </div>
                <div className="space-y-3 bg-card p-4">
                  <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border/70 bg-border/60">
                    {[
                      { label: "Completed", value: "128" },
                      { label: "Scheduled", value: "6" },
                      { label: "Running", value: "2" },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-card px-3 py-2.5">
                        <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                        <p className="mt-0.5 text-lg font-semibold tabular-nums">
                          {stat.value}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-md border border-border/70 p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">Reddit Trend Radar</p>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 px-2 py-0.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                        Running
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      daily · 08:00 · reddit → docs → slack
                    </p>
                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-[78%] rounded-full bg-primary/70" />
                    </div>
                    <p className="mt-2.5 text-xs text-muted-foreground">
                      Browsing r/artificial → writing Google Doc → notifying Slack
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 px-3.5 py-3 text-sm">
                    <span className="font-medium">Groovy AI</span>{" "}
                    <span className="text-muted-foreground">
                      generated a new agent in 8 seconds
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </section>

        {/* Integrations — one quiet line */}
        <section className="border-y border-border/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6">
            <p className="text-center font-mono text-xs text-muted-foreground">
              {INTEGRATIONS.map((name, index) => (
                <span key={name}>
                  {name}
                  {index < INTEGRATIONS.length - 1 ? (
                    <span className="mx-2 text-foreground/25">·</span>
                  ) : null}
                </span>
              ))}
              <span className="mx-2 text-foreground/25">·</span>+ 100 more
            </p>
          </div>
        </section>

        {/* Features — three, type-led */}
        <section id="features" className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
          <FadeIn className="max-w-2xl">
            <p className="font-mono text-xs tracking-[0.15em] text-muted-foreground uppercase">
              Features
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
              Everything a serious agent platform needs.
              <br />
              <span className="text-muted-foreground">Nothing it doesn&rsquo;t.</span>
            </h2>
          </FadeIn>
          <Stagger className="mt-14 grid gap-10 sm:grid-cols-3" as="div">
            {FEATURES.map((feature) => (
              <StaggerItem key={feature.overline}>
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-[0.15em]">
                  {feature.overline}
                </p>
                <h3 className="mt-3 font-semibold tracking-tight">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.body}
                </p>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* How it works — numbered rows */}
        <section id="how" className="border-y border-border/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
            <FadeIn className="max-w-2xl">
              <p className="font-mono text-xs tracking-[0.15em] text-muted-foreground uppercase">
                How it works
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
                From sentence to autonomous workflow.
              </h2>
            </FadeIn>
            <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-border/70 bg-border/60 md:grid-cols-2">
              {STEPS.map((step, index) => (
                <FadeIn key={step.number} delay={index * 0.04}>
                  <div className="h-full bg-background p-6">
                    <span className="font-mono text-xs text-muted-foreground">
                      {step.number}
                    </span>
                    <h3 className="mt-3 font-semibold tracking-tight">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* Templates */}
        <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
          <FadeIn className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="font-mono text-xs tracking-[0.15em] text-muted-foreground uppercase">
                Templates
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
                Start from real work.
              </h2>
            </div>
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link href={primaryHref}>Browse all templates</Link>
            </Button>
          </FadeIn>
          <Stagger className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {agentTemplates.slice(0, 4).map((template) => {
              const TemplateIcon = iconFor(template.icon);
              const brandSlug = brandSlugForToolNames(template.tools);
              return (
                <StaggerItem key={template.id}>
                  <Link
                    href={primaryHref}
                    className="group flex h-full flex-col rounded-lg border border-border/70 bg-card p-5 transition-colors hover:border-foreground/15"
                  >
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                      {brandSlug ? (
                        <ToolIcon name={null} slug={brandSlug} className="size-5" />
                      ) : (
                        <TemplateIcon className="size-4 text-muted-foreground" />
                      )}
                    </div>
                    <h3 className="mt-3 text-sm font-medium tracking-tight">
                      {template.title}
                    </h3>
                    <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">
                      {template.description}
                    </p>
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                      {template.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-border/70 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </Link>
                </StaggerItem>
              );
            })}
          </Stagger>
        </section>

        {/* CTA — quiet, single accent */}
        <section className="border-t border-border/60">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-24 text-center sm:px-6">
            <FadeIn>
              <Image src="/logo.svg" alt="" width={40} height={40} />
              <h2 className="mt-6 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
                Your first agent is five minutes away.
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-pretty text-muted-foreground">
                Start with the demo workspace — sample agents, runs and
                integrations included — then build your own.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
                <Button asChild size="lg" className="h-9 px-4 text-[15px]">
                  <Link href={primaryHref}>Get started free</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-9 px-4 text-[15px]">
                  <Link href="/sign-in">Sign in</Link>
                </Button>
              </div>
            </FadeIn>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <Image src="/logo.svg" alt="" width={20} height={20} />
            <span>© {new Date().getFullYear()} Groovy AI</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/pricing" className="transition-colors hover:text-foreground">
              Pricing
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
