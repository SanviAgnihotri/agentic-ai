"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  Bot,
  CalendarClock,
  ChevronRight,
  Filter,
  Loader2,
  PlayCircle,
  RefreshCcw,
  Square,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { RunRowsSkeleton } from "@/components/runs/runs-skeleton";
import { apiFetch, usePoll } from "@/hooks/use-poll";
import { formatDuration, relativeTime, shortDateTime, truncate } from "@/lib/format";

interface RunRow {
  id: number;
  agentId: string;
  agentName: string | null;
  agentImage: string | null;
  status: string;
  trigger: string;
  createdAt: string;
  scheduleFor: string;
  startedAt: string | null;
  completedAt: string | null;
  output: string | null;
  error: string | null;
}

interface RunsResponse {
  runs: RunRow[];
  stats: Record<string, number>;
}

const FILTERS = [
  { value: "all", label: "All" },
  { value: "running,queued", label: "Live" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

export function RunsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Filters live in the URL: tabs and agent selection are deep-linkable and
  // survive reloads / back-forward. Search stays local so typing can't be
  // interrupted, and is mirrored into `?q=` on a short debounce.
  const status = searchParams.get("status") ?? "all";
  const agentFilter = searchParams.get("agentId") ?? "all";
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [stopTarget, setStopTarget] = useState<RunRow | null>(null);

  const setQuery = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Debounced search → URL (keeps shareable state without per-keystroke nav).
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((searchParams.get("q") ?? "") === search) return;
      const params = new URLSearchParams(searchParams.toString());
      if (search) params.set("q", search);
      else params.delete("q");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 350);
    return () => clearTimeout(timer);
  }, [search, searchParams, pathname, router]);

  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: "80" });
    if (status !== "all") params.set("status", status);
    if (agentFilter !== "all") params.set("agentId", agentFilter);
    return params.toString();
  }, [status, agentFilter]);

  const { data, error, loading, refresh } = usePoll<RunsResponse>(
    () => apiFetch<RunsResponse>(`/api/runs?${query}`),
    4000,
    [query],
  );

  const stopRun = async (id: number) => {
    try {
      const result = await apiFetch<{ cancelled: boolean; status: string }>(
        `/api/runs/${id}/cancel`,
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
    }
  };

  const { data: agentsData } = usePoll<{
    agents: Array<{ agentId: string; name: string | null }>;
  }>(() => apiFetch("/api/agent/configure"), null);

  const runs = (data?.runs ?? []).filter((run) => {
    if (!search) return true;
    return `${run.agentName ?? ""} ${run.output ?? ""} ${run.error ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase());
  });

  const live =
    (data?.stats.running ?? 0) + (data?.stats.queued ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Runs</h1>
          <p className="text-sm text-muted-foreground">
            Live execution logs for every agent — scheduled, manual and chat runs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {live > 0 && (
            <Badge variant="outline" className="gap-1.5 border-primary/30 text-primary">
              <Loader2 className="size-3 animate-spin" />
              {live} executing
            </Badge>
          )}
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link href="/dashboard/agents?tab=create">
              <PlayCircle className="size-4" />
              New agent
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Tabs value={status} onValueChange={(value) => setQuery({ status: value })}>
            <TabsList className="h-9">
              {FILTERS.map((filter) => (
                <TabsTrigger key={filter.value} value={filter.value} className="text-xs">
                  {filter.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative min-w-48 flex-1">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search output…"
              aria-label="Search runs"
              type="search"
              className="h-9"
            />
          </div>
          <Select
            value={agentFilter}
            onValueChange={(value) => setQuery({ agentId: value })}
          >
            <SelectTrigger className="h-9 w-52" aria-label="Filter by agent">
              <Filter className="size-3.5" />
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {(agentsData?.agents ?? []).map((agent) => (
                <SelectItem key={agent.agentId} value={agent.agentId}>
                  {agent.name ?? "Agent"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {error && !data ? (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <TriangleAlert className="size-5 text-destructive" />
            <div>
              <p className="font-medium">Couldn’t load runs</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => void refresh()}
            >
              <RefreshCcw className="size-3.5" />
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : loading && !data ? (
        <RunRowsSkeleton />
      ) : runs.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No runs found"
          description="Run an agent or wait for the next scheduled execution — every step will appear here."
        />
      ) : (
        <div className="space-y-3">
          {runs.map((run) => {
            const active = run.status === "running" || run.status === "queued";
            return (
              <Card
                key={run.id}
                className="relative border-border/70 transition hover:border-foreground/15"
              >
                {/* Stretched link keeps the whole row clickable without
                    nesting the Stop button inside an anchor. */}
                <Link
                  href={`/dashboard/runs/${run.id}`}
                  aria-label={`Open run for ${run.agentName ?? "agent"}`}
                  className="absolute inset-0 z-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
                <CardContent className="flex items-center gap-4 p-4">
                  <Avatar className="size-10 rounded-xl border border-border">
                    <AvatarImage src={run.agentImage ?? undefined} alt="" />
                    <AvatarFallback className="rounded-md bg-muted text-muted-foreground">
                      <Bot className="size-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{run.agentName ?? "Agent"}</p>
                      <StatusBadge status={run.status} />
                      <Badge variant="secondary" className="text-[11px] capitalize">
                        {run.trigger}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                      {run.status === "failed"
                        ? run.error ?? "Run failed"
                        : run.output
                          ? truncate(
                              run.output
                                .replace(/[#>*_`-]/g, " ")
                                .replace(/\s+/g, " ")
                                .trim(),
                              140,
                            )
                          : run.status === "scheduled"
                            ? `Scheduled for ${shortDateTime(run.scheduleFor)}`
                            : "Waiting for output…"}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right text-xs text-muted-foreground tabular-nums sm:block">
                    <p>{relativeTime(run.createdAt)}</p>
                    {run.completedAt && run.startedAt && (
                      <p>
                        {formatDuration(
                          new Date(run.completedAt).getTime() -
                            new Date(run.startedAt).getTime(),
                        )}
                      </p>
                    )}
                  </div>
                  {active ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="relative z-10 h-8 shrink-0 gap-1.5 text-xs text-red-600 dark:text-red-400"
                      onClick={() => setStopTarget(run)}
                    >
                      <Square className="size-3" />
                      Stop
                    </Button>
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-center gap-2 pb-4 text-xs text-muted-foreground">
        <ArrowUpRight className="size-3.5" />
        Click any run to see the full step-by-step timeline.
      </div>

      <AlertDialog
        open={stopTarget !== null}
        onOpenChange={(open) => {
          if (!open) setStopTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop this run?</AlertDialogTitle>
            <AlertDialogDescription>
              {stopTarget?.agentName ?? "This agent"} will finish the current step and
              then stop. Partial output is kept and the run is marked as cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep running</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (stopTarget) void stopRun(stopTarget.id);
                setStopTarget(null);
              }}
            >
              Stop run
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
