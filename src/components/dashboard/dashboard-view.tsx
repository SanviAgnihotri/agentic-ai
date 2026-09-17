"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  FileText,
  PlayCircle,
  Radar,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { CountUp } from "@/components/motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { apiFetch, usePoll } from "@/hooks/use-poll";
import { relativeTime, shortDateTime } from "@/lib/format";

interface DashboardRun {
  id: number;
  agentId: string;
  agentName: string;
  agentImage: string | null;
  status: string;
  scheduleFor: string;
  createdAt: string;
  output: string | null;
  error: string | null;
  excerpt?: string | null;
}

interface DashboardData {
  stats: {
    agents: number;
    activeAgents: number;
    pausedAgents: number;
    completed: number;
    failed: number;
    running: number;
    queued: number;
    scheduled: number;
  };
  upcoming: DashboardRun[];
  latest: DashboardRun[];
  activity: Array<{ day: string; completed: number; failed: number }>;
  briefing?: string;
  ai: { provider: string; model: string; live: boolean };
}

const chartConfig = {
  completed: { label: "Completed", color: "var(--chart-1)" },
  failed: { label: "Failed", color: "var(--chart-5)" },
} satisfies ChartConfig;

export function DashboardView({
  initialData,
}: {
  initialData?: DashboardData;
}) {
  const { data, error, loading, refresh } = usePoll<DashboardData>(
    () => apiFetch<DashboardData>("/api/dashboard"),
    30_000,
    [],
    initialData,
  );

  const activities = useMemo(
    () =>
      (data?.activity ?? []).map((entry) => ({
        ...entry,
        // Explicit UTC keeps the weekday stable between SSR and hydration.
        label: new Intl.DateTimeFormat("en", {
          weekday: "short",
          timeZone: "UTC",
        }).format(new Date(entry.day)),
      })),
    [data?.activity],
  );

  if (error && !data) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <XCircle className="size-5 text-destructive" />
          <div>
            <p className="font-medium">Couldn’t load your dashboard</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading && !data) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const completed = stats?.completed ?? 0;
  const failed = stats?.failed ?? 0;
  const finished = completed + failed;
  const successRate = finished > 0 ? Math.round((completed / finished) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active agents"
          value={stats?.activeAgents ?? 0}
          sub={`${stats?.pausedAgents ?? 0} paused`}
          icon={Bot}
          tone="text-primary"
          href="/dashboard/agents"
        />
        <StatCard
          label="Completed runs"
          value={stats?.completed ?? 0}
          sub="All time"
          icon={CheckCircle2}
          tone="text-emerald-600 dark:text-emerald-400"
          href="/dashboard/runs?status=completed"
        />
        <StatCard
          label="Scheduled"
          value={stats?.scheduled ?? 0}
          sub="Upcoming executions"
          icon={CalendarClock}
          tone="text-sky-600 dark:text-sky-400"
          href="/dashboard/runs?status=scheduled"
        />
        <StatCard
          label="Needs attention"
          value={(stats?.failed ?? 0) + (stats?.running ?? 0)}
          sub={`${stats?.failed ?? 0} failed · ${stats?.running ?? 0} running`}
          icon={XCircle}
          tone="text-red-600 dark:text-red-400"
          href="/dashboard/runs?status=failed"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-primary" />
              Run activity
            </CardTitle>
            <CardDescription>Executions across the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-56 w-full">
              <AreaChart data={activities} margin={{ left: 0, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="fillCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="fillFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-5)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="var(--chart-5)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="completed"
                  type="monotone"
                  fill="url(#fillCompleted)"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  stackId="a"
                />
                <Area
                  dataKey="failed"
                  type="monotone"
                  fill="url(#fillFailed)"
                  stroke="var(--chart-5)"
                  strokeWidth={2}
                  stackId="a"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Upcoming */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="size-4 text-muted-foreground" />
                Upcoming runs
              </CardTitle>
              <CardDescription>Agents working while you sleep</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
              <Link href="/dashboard/runs?status=scheduled">
                All <ArrowRight className="size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.upcoming.length ? (
              data.upcoming.slice(0, 5).map((run) => (
                <Link
                  key={run.id}
                  href={`/dashboard/runs/${run.id}`}
                  className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-left transition hover:border-primary/30 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10">
                    <CalendarClock className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{run.agentName}</p>
                    <p className="text-xs text-muted-foreground">
                      {shortDateTime(run.scheduleFor)}
                    </p>
                  </div>
                  <ArrowUpRight className="size-3.5 text-muted-foreground" />
                </Link>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No scheduled runs. Create a recurring agent to fill this space.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Latest results */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4 text-primary" />
                Latest results
              </CardTitle>
              <CardDescription>Deliverables your agents produced</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
              <Link href="/dashboard/runs">
                All runs <ArrowRight className="size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.latest.length ? (
              data.latest.map((run) => (
                <Link
                  key={run.id}
                  href={`/dashboard/runs/${run.id}`}
                  className="flex w-full items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-left transition hover:border-primary/30 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <div className="mt-0.5">
                    <StatusBadge status={run.status} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium">{run.agentName}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {relativeTime(run.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {run.error ?? run.excerpt ?? "No output"}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No completed runs yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="size-4 text-muted-foreground" />
              Quick actions
            </CardTitle>
            <CardDescription>Jump straight into work</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <QuickAction
              icon={Sparkles}
              title="Create a new agent"
              description="Describe any recurring task"
              href="/dashboard/agents?tab=create"
            />
            <QuickAction
              icon={Radar}
              title="Browse templates"
              description="Pre-built agents ready to use"
              href="/dashboard/templates"
            />
            <QuickAction
              icon={PlayCircle}
              title="Run an agent now"
              description="Kick off an immediate execution"
              href="/dashboard/agents"
            />
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Success rate</span>
                <span className="tabular-nums text-muted-foreground">
                  {successRate}%
                </span>
              </div>
              <Progress
                value={successRate}
                aria-label="Run success rate"
                className="mt-2 h-1.5"
              />
              <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">
                {completed} completed · {failed} failed
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => void refresh()}
            >
              Refresh data
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: number;
  sub: string;
  icon: typeof Bot;
  tone: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <Card className="h-full border-border/70 transition-colors hover:border-foreground/15">
        <CardContent className="flex items-start justify-between p-5">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">
              <CountUp value={value} />
            </p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
          <div className="rounded-lg bg-muted p-2.5">
            <Icon className={`size-4 ${tone}`} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function QuickAction({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: typeof Sparkles;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-left transition hover:border-primary/30 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="size-3.5 text-muted-foreground" />
    </Link>
  );
}
