"use client";

import { useMemo, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
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
import { absoluteTime, relativeTime, shortDateTime } from "@/lib/format";

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
  const router = useRouter();
  const { data, loading, refresh } = usePoll<DashboardData>(
    () => apiFetch<DashboardData>("/api/dashboard"),
    30_000,
    [],
    initialData,
  );

  const activities = useMemo(
    () =>
      (data?.activity ?? []).map((entry) => ({
        ...entry,
        label: new Date(entry.day).toLocaleDateString("en", { weekday: "short" }),
      })),
    [data?.activity],
  );

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  const stats = data?.stats;

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
          onClick={() => router.push("/dashboard/agents")}
        />
        <StatCard
          label="Completed runs"
          value={stats?.completed ?? 0}
          sub="All time"
          icon={CheckCircle2}
          tone="text-foreground"
          onClick={() => router.push("/dashboard/runs?status=completed")}
        />
        <StatCard
          label="Scheduled"
          value={stats?.scheduled ?? 0}
          sub="Upcoming executions"
          icon={CalendarClock}
          tone="text-foreground"
          onClick={() => router.push("/dashboard/runs?status=scheduled")}
        />
        <StatCard
          label="Needs attention"
          value={(stats?.failed ?? 0) + (stats?.running ?? 0)}
          sub={`${stats?.failed ?? 0} failed · ${stats?.running ?? 0} running`}
          icon={XCircle}
          tone="text-red-500"
          onClick={() => router.push("/dashboard/runs?status=failed,running")}
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
                <button
                  key={run.id}
                  onClick={() => router.push(`/dashboard/runs/${run.id}`)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-left transition hover:border-primary/30 hover:bg-muted/40"
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
                </button>
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
                <button
                  key={run.id}
                  onClick={() => router.push(`/dashboard/runs/${run.id}`)}
                  className="flex w-full items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-left transition hover:border-primary/30 hover:bg-muted/40"
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
                </button>
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
              onClick={() => router.push("/dashboard/agents?tab=create")}
            />
            <QuickAction
              icon={Radar}
              title="Browse templates"
              description="Pre-built agents ready to use"
              onClick={() => router.push("/dashboard/templates")}
            />
            <QuickAction
              icon={PlayCircle}
              title="Run an agent now"
              description="Kick off an immediate execution"
              onClick={() => router.push("/dashboard/agents")}
            />
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Completed this week</span>
                <span className="text-muted-foreground">
                  {stats?.completed ?? 0} runs
                </span>
              </div>
              <Progress
                value={Math.min(100, (stats?.completed ?? 0) * 4)}
                className="mt-2 h-1.5"
              />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Last refreshed {relativeTime(new Date())}
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
  onClick,
}: {
  label: string;
  value: number;
  sub: string;
  icon: typeof Bot;
  tone: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className="cursor-pointer border-border/70 transition-colors hover:border-foreground/15"
      onClick={onClick}
    >
      <CardContent className="flex items-start justify-between p-5">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold tabular-nums tracking-tight">
            <CountUp value={value} />
          </p>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
        <div className={`rounded-lg bg-muted p-2.5 ${tone}`}>
          <Icon className="size-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof Sparkles;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-left transition hover:border-primary/30 hover:bg-muted/40"
    >
      <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="size-3.5 text-muted-foreground" />
    </button>
  );
}
