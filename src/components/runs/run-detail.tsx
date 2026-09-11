"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Braces,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  FileText,
  Flame,
  Globe2,
  GitBranch,
  Info,
  Loader2,
  Mail,
  MessageSquare,
  NotebookText,
  Play,
  Search,
  Send,
  Sparkles,
  Square,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/components/shared/markdown";
import { ToolIcon } from "@/components/shared/tool-icon";
import { TOOL_CATALOG } from "@/agent/tools/catalog";
import { StatusBadge } from "@/components/shared/status-badge";
import type { RunStep } from "@/db/schema";
import { apiFetch, usePoll } from "@/hooks/use-poll";
import { absoluteTime, formatDuration, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface RunDetailResponse {
  run: {
    id: number;
    agentId: string;
    status: string;
    trigger: string;
    createdAt: string;
    scheduleFor: string;
    startedAt: string | null;
    completedAt: string | null;
    output: string | null;
    error: string | null;
    steps: RunStep[] | null;
  };
  agent: {
    agentId: string;
    name: string | null;
    agentImage: string | null;
    description: string | null;
    status: string | null;
  } | null;
}

const STEP_ICONS: Record<RunStep["type"], typeof Info> = {
  info: Info,
  thought: Sparkles,
  tool_call: Sparkles,
  tool_result: CheckCircle2,
  browser: Globe2,
  final: FileText,
  error: AlertTriangle,
};

const STEP_STYLES: Record<RunStep["type"], string> = {
  info: "border-border bg-muted text-muted-foreground",
  thought: "border-primary/30 bg-muted text-muted-foreground",
  tool_call: "border-primary/30 bg-muted text-muted-foreground",
  tool_result: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  browser: "border-cyan-500/30 bg-cyan-500/10 text-cyan-500",
  final: "border-sky-500/30 bg-sky-500/10 text-sky-500",
  error: "border-red-500/30 bg-red-500/10 text-red-500",
};

/** A real, recognizable icon per integration instead of one generic wand. */
const TOOL_ICON_RULES: Array<[RegExp, LucideIcon]> = [
  [/WEB_SEARCH|SERP/i, Search],
  [/TELEGRAM/i, Send],
  [/BROWSER_/i, Globe2],
  [/REDDIT/i, Flame],
  [/GMAIL/i, Mail],
  [/OUTLOOK/i, Mail],
  [/SLACK|DISCORD/i, MessageSquare],
  [/GOOGLEDOCS|DOCS/i, FileText],
  [/NOTION/i, NotebookText],
  [/GITHUB/i, GitBranch],
  [/GOOGLECALENDAR|CALENDLY|ZOOM/i, Clock3],
];

function toolIconFor(slug: string): LucideIcon {
  for (const [rule, icon] of TOOL_ICON_RULES) {
    if (rule.test(slug)) return icon;
  }
  return Sparkles;
}

/** "GMAIL_SEND_EMAIL" → the catalog tool that owns that action. */
function toolForAction(actionSlug: string) {
  return (
    TOOL_CATALOG.find((tool) =>
      tool.actions.some((action) => action.slug === actionSlug),
    ) ?? null
  );
}

/** "WEB_SEARCH" -> "Web Search" */
function humanizeSlug(slug: string): string {
  return slug
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function RunDetail({ runId }: { runId: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const { data, loading, refresh } = usePoll<RunDetailResponse>(
    () => apiFetch<RunDetailResponse>(`/api/runs/${runId}`),
    2500,
    [runId],
  );

  const run = data?.run;
  const agent = data?.agent;
  const steps = run?.steps ?? [];
  const isActive = run?.status === "running" || run?.status === "queued";

  // Merge each tool call with its result so the timeline reads as "one action,
  // one outcome" instead of two duplicate-looking rows.
  const timelineRows: Array<
    | { kind: "tool"; call: RunStep; result: RunStep }
    | { kind: "running-call"; call: RunStep }
    | { kind: "simple"; step: RunStep }
  > = [];
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const next = steps[index + 1];
    if (step.type === "tool_call" && next?.type === "tool_result") {
      timelineRows.push({ kind: "tool", call: step, result: next });
      index += 1;
    } else if (step.type === "tool_call") {
      timelineRows.push({ kind: "running-call", call: step });
    } else {
      timelineRows.push({ kind: "simple", step });
    }
  }

  // Keep the newest steps in view while a run is live.
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const lastStepCountRef = useRef(0);
  useEffect(() => {
    if (isActive && steps.length !== lastStepCountRef.current) {
      lastStepCountRef.current = steps.length;
      timelineRef.current?.scrollTo({
        top: timelineRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [steps.length, isActive]);
  const liveUrl = steps
    .map((step) => {
      const output = step.output as Record<string, unknown> | undefined;
      return typeof output?.liveUrl === "string" ? output.liveUrl : null;
    })
    .find(Boolean);
  const duration =
    run?.startedAt && run?.completedAt
      ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
      : null;

  const runAgain = async () => {
    if (!run) return;
    setRunning(true);
    try {
      const result = await apiFetch<{ runId: number }>("/api/agent/run", {
        method: "POST",
        json: { agentId: run.agentId, mode: "run" },
      });
      toast.success("New run started");
      router.push(`/dashboard/runs/${result.runId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the run");
    } finally {
      setRunning(false);
    }
  };

  const stopRun = async () => {
    setStopping(true);
    try {
      const result = await apiFetch<{ cancelled: boolean; status: string }>(
        `/api/runs/${runId}/cancel`,
        { method: "POST" },
      );
      if (result.cancelled) {
        toast.success(
          result.status === "stopping"
            ? "Stopping after the current step…"
            : "Run cancelled",
        );
      } else {
        toast.info(`Run is already ${result.status}`);
      }
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not stop the run");
    } finally {
      setStopping(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-muted-foreground">Run not found.</p>
        <Button asChild variant="outline">
          <Link href="/dashboard/runs">Back to runs</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto lg:h-[calc(100svh-3.5rem-3rem)] lg:flex-none lg:overflow-hidden">
      <div className="flex shrink-0 items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link href="/dashboard/runs">
            <ArrowLeft className="size-4" />
            Runs
          </Link>
        </Button>
      </div>

      <Card className="shrink-0 border-border/70">
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <Avatar className="size-12 rounded-xl border border-border">
            <AvatarImage src={agent?.agentImage ?? undefined} alt="" />
            <AvatarFallback className="rounded-md bg-muted text-muted-foreground">
              <Bot className="size-5" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold">{agent?.name ?? "Agent"}</h1>
              <StatusBadge status={run.status} />
              <Badge variant="secondary" className="text-[10px] capitalize">
                {run.trigger} run
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Run #{run.id} · started {relativeTime(run.startedAt ?? run.createdAt)}
              {duration !== null && ` · took ${formatDuration(duration)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {liveUrl && (
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                  <Globe2 className="size-3.5" />
                  Live browser
                  <ExternalLink className="size-3" />
                </a>
              </Button>
            )}
            {isActive && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-red-600 dark:text-red-400"
                onClick={stopRun}
                disabled={stopping}
              >
                {stopping ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Square className="size-3.5" />
                )}
                Stop run
              </Button>
            )}
            <Button size="sm" className="gap-1.5" onClick={runAgain} disabled={running}>
              {running ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
              Run again
            </Button>
          </div>
        </CardContent>
      </Card>

      {run.status === "scheduled" && (
        <Card className="shrink-0 border-sky-500/20 bg-sky-500/5">
          <CardContent className="flex items-center gap-3 p-4 text-sm">
            <Clock3 className="size-4 text-sky-500" />
            Scheduled to execute {absoluteTime(run.scheduleFor)} ({relativeTime(run.scheduleFor)}).
            The built-in scheduler and Inngest workers pick it up automatically.
          </CardContent>
        </Card>
      )}

      {run.error && (
        <Card className="shrink-0 border-red-500/25 bg-red-500/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                Run failed
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">{run.error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid min-h-0 flex-1 gap-6 lg:overflow-hidden lg:grid-cols-[1.4fr_1fr] lg:[grid-template-rows:minmax(0,1fr)]">
        {/* Timeline — fixed height, scrolls internally */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Execution timeline</CardTitle>
            <Badge variant="secondary" className="text-[10px]">
              {steps.length} steps
            </Badge>
          </CardHeader>
          <CardContent
            ref={timelineRef}
            className="min-h-0 flex-1 overflow-y-auto pr-1"
          >
            {steps.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  {isActive ? (
                    <Loader2 className="size-5 animate-spin text-primary" />
                  ) : (
                    <Info className="size-5 text-muted-foreground" />
                  )}
                </div>
                <p className="text-sm font-medium">
                  {isActive ? "Agent is starting up" : "No steps yet"}
                </p>
                <p className="max-w-60 text-xs text-muted-foreground">
                  {isActive
                    ? "Live updates appear here as the agent works."
                    : "This run has no recorded execution steps."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {timelineRows.map((row) => {
                  if (row.kind === "tool") {
                    const slug = row.call.title.replace(/^Using /, "");
                    const tool = toolForAction(slug);
                    const payload = {
                      input: row.call.input,
                      output: row.result.output,
                    };
                    const hasPayload =
                      payload.input !== undefined ||
                      (payload.output !== undefined && payload.output !== null);
                    return (
                      <div key={row.call.index} className="flex gap-3">
                        <div
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                            STEP_STYLES.tool_call,
                          )}
                        >
                          <ToolIcon name={tool?.icon ?? null} slug={tool?.slug} color={tool?.color} className="size-4" fallback={toolIconFor(slug)} />
                        </div>
                        <div className="min-w-0 flex-1 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 transition hover:border-foreground/15">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="min-w-0 truncate text-sm font-medium">
                              {humanizeSlug(slug)}
                            </p>
                            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                              {row.result.durationMs
                                ? formatDuration(row.result.durationMs)
                                : new Date(row.call.at).toLocaleTimeString()}
                            </span>
                          </div>
                          {hasPayload && (
                            <Collapsible className="mt-1.5">
                              <CollapsibleTrigger className="group flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground">
                                <ChevronDown className="size-3 transition group-data-[state=open]:rotate-180" />
                                View input & output
                              </CollapsibleTrigger>
                              <CollapsibleContent className="mt-2 space-y-2">
                                {payload.input !== undefined && (
                                  <StepPayload label="Input" value={payload.input} />
                                )}
                                {payload.output !== undefined &&
                                  payload.output !== null && (
                                    <StepPayload label="Output" value={payload.output} />
                                  )}
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </div>
                      </div>
                    );
                  }
                  if (row.kind === "running-call") {
                    const slug = row.call.title.replace(/^Using /, "");
                    const tool = toolForAction(slug);
                    return (
                      <div key={row.call.index} className="flex gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-muted text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" />
                        </div>
                        <div className="min-w-0 flex-1 rounded-md bg-muted px-3 py-2.5">
                          <p className="text-sm font-medium">{humanizeSlug(slug)}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">Running…</p>
                        </div>
                      </div>
                    );
                  }
                  const step = row.step;
                  const Icon = STEP_ICONS[step.type] ?? Info;
                  const hasPayload =
                    step.input !== undefined ||
                    (step.output !== undefined && step.output !== null);
                  return (
                    <div key={step.index} className="flex gap-3">
                      <div
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                          STEP_STYLES[step.type] ?? STEP_STYLES.info,
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div
                        className={cn(
                          "min-w-0 flex-1 rounded-xl border px-3 py-2.5 transition hover:border-foreground/15",
                          step.type === "error"
                            ? "border-red-500/25 bg-red-500/5"
                            : step.type === "final"
                              ? "border-sky-500/25 bg-sky-500/5"
                              : "border-border/60 bg-muted/20",
                        )}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="min-w-0 truncate text-sm font-medium">{step.title}</p>
                          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                            {step.durationMs
                              ? formatDuration(step.durationMs)
                              : new Date(step.at).toLocaleTimeString()}
                          </span>
                        </div>
                        {step.detail && (
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {step.detail}
                          </p>
                        )}
                        {hasPayload && (
                          <Collapsible className="mt-1.5">
                            <CollapsibleTrigger className="group flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground">
                              <ChevronDown className="size-3 transition group-data-[state=open]:rotate-180" />
                              View input & output
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2 space-y-2">
                              {step.input !== undefined && (
                                <StepPayload label="Input" value={step.input} />
                              )}
                              {step.output !== undefined && step.output !== null && (
                                <StepPayload label="Output" value={step.output} />
                              )}
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </div>
                    </div>
                  );
                })}
                {isActive && (
                  <div className="flex gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-muted text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                    </div>
                    <p className="py-2.5 text-sm text-muted-foreground">
                      Working on the next step…
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deliverable — fixed height, scrolls internally */}
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4 text-primary" />
              Deliverable
            </CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto pr-1">
            {run.output ? (
              <Markdown>{run.output}</Markdown>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {isActive ? "The deliverable appears when the run finishes." : "No output."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StepPayload({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <Braces className="size-3" />
        {label}
      </p>
      <pre className="max-h-64 overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
