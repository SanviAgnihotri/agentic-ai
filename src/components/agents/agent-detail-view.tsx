"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  CalendarClock,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  PlayCircle,
  Save,
  Settings2,
  Sparkles,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { ToolIcon } from "@/components/shared/tool-icon";
import {
  AgentConfigForm,
  type AgentDraft,
  type ToolConnectionInfo,
} from "./agent-config-form";
import { AgentChat } from "./agent-chat";
import type { AgentWithRuns } from "./agent-card";
import { apiFetch, usePoll } from "@/hooks/use-poll";
import { describeSchedule } from "@/agent/schedule";
import { relativeTime, shortDateTime, truncate } from "@/lib/format";
import { toolBySlug } from "@/agent/tools/catalog";

interface DetailResponse {
  agent: AgentWithRuns;
  runs: Array<{
    id: number;
    status: string;
    trigger: string;
    createdAt: string;
    scheduleFor: string;
    output: string | null;
    error: string | null;
  }>;
  connections: Array<{
    slug: string;
    connected: boolean;
    accountLabel: string | null;
  }>;
}

export function AgentDetailView({ agentId }: { agentId: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<AgentDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const { data, loading, refresh } = usePoll<DetailResponse>(
    () => apiFetch<DetailResponse>(`/api/agents/${agentId}`),
    10_000,
    [agentId],
  );

  const agent = data?.agent;
  const connections: ToolConnectionInfo[] = data?.connections ?? [];

  const ensureDraft = (row: AgentWithRuns): AgentDraft => ({
    agentId: row.agentId,
    name: row.name ?? "",
    description: row.description ?? "",
    objective: row.objective ?? "",
    instructions: row.instructions ?? "",
    tools: row.tools ?? [],
    skills: row.skills ?? [],
    schedule: row.schedule ?? { type: "manual", time: "09:00" },
    outputFormat: row.outputFormat ?? "",
    agentImage: row.agentImage ?? undefined,
    status: row.status ?? "active",
  });

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await apiFetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        json: {
          ...draft,
        },
      });
      toast.success("Agent updated");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const result = await apiFetch<{ runId: number }>("/api/agent/run", {
        method: "POST",
        json: { agentId, mode: "run" },
      });
      toast.success("Agent started");
      router.push(`/dashboard/runs/${result.runId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start");
    } finally {
      setRunning(false);
    }
  };

  const toggleStatus = async () => {
    if (!agent) return;
    try {
      await apiFetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        json: { status: agent.status === "active" ? "paused" : "active" },
      });
      toast.success(agent.status === "active" ? "Agent paused" : "Agent resumed");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update");
    }
  };

  const connectTool = async (slug: string) => {
    try {
      const result = await apiFetch<{ redirectUrl: string | null }>(
        "/api/agent/tools/connect",
        { method: "POST", json: { toolSlug: slug, agentId } },
      );
      if (result.redirectUrl) window.open(result.redirectUrl, "_blank");
      else toast.success("Connected");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not connect");
    }
  };

  const disconnectTool = async (slug: string) => {
    try {
      await apiFetch("/api/agent/tools/connect", {
        method: "DELETE",
        json: { toolSlug: slug, agentId },
      });
      toast.success("Disconnected");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect");
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!agent) {
    return (
      <EmptyState
        icon={Bot}
        title="Agent not found"
        description="It may have been deleted."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard/agents?tab=mine">Back to agents</Link>
          </Button>
        }
      />
    );
  }

  const currentDraft = draft ?? ensureDraft(agent);
  const runs = data?.runs ?? [];
  const completed = runs.filter((run) => run.status === "completed").length;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="gap-1.5">
        <Link href="/dashboard/agents?tab=mine">
          <ArrowLeft className="size-4" />
          Agents
        </Link>
      </Button>

      <Card className="overflow-hidden">
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <Avatar className="size-16 rounded-xl border border-border">
            <AvatarImage src={agent.agentImage ?? undefined} alt={agent.name ?? ""} />
            <AvatarFallback className="rounded-md bg-muted text-muted-foreground">
              <Bot className="size-6" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{agent.name}</h1>
              <StatusBadge status={agent.status} kind="agent" />
            </div>
            <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
              {agent.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={toggleStatus}
            >
              <Pause className="size-3.5" />
              {agent.status === "active" ? "Pause" : "Resume"}
            </Button>
            <Button size="sm" className="gap-1.5" onClick={runNow} disabled={running}>
              {running ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5" />
              )}
              Run now
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat
          icon={CalendarClock}
          label="Schedule"
          value={
            currentDraft.schedule.type === "manual"
              ? "On demand"
              : describeSchedule(currentDraft.schedule)
          }
        />
        <MiniStat
          icon={PlayCircle}
          label="Completed runs"
          value={String(completed)}
        />
        <MiniStat
          icon={Wrench}
          label="Tools"
          value={String(currentDraft.tools.length)}
        />
        <MiniStat
          icon={Sparkles}
          label="Skills"
          value={String(currentDraft.skills.length)}
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-10">
          <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
            <Bot className="size-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="configuration" className="gap-1.5 text-xs sm:text-sm">
            <Settings2 className="size-3.5" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-1.5 text-xs sm:text-sm">
            <MessageSquare className="size-3.5" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="runs" className="gap-1.5 text-xs sm:text-sm">
            <PlayCircle className="size-3.5" />
            Runs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Objective</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p className="text-muted-foreground">{currentDraft.objective}</p>
                <Separator />
                <div>
                  <p className="mb-2 font-medium">Instructions</p>
                  <pre className="max-h-64 overflow-y-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                    {currentDraft.instructions}
                  </pre>
                </div>
                <Separator />
                <div>
                  <p className="mb-2 font-medium">Output format</p>
                  <p className="text-muted-foreground">{currentDraft.outputFormat}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Toolset</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {currentDraft.tools.map((slug) => {
                  const tool = toolBySlug.get(slug);
                  const connection = connections.find((c) => c.slug === slug);
                  const connected = !tool?.requiresAuth || connection?.connected;
                  return (
                    <div
                      key={slug}
                      className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/20 p-3"
                    >
                      <div
                        className="flex size-9 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${tool?.color ?? "#888"}1a` }}
                      >
                        <ToolIcon name={tool?.icon} slug={tool?.slug} color={tool?.color} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{tool?.name ?? slug}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {connected
                            ? (connection?.accountLabel ?? "Available")
                            : "Not connected"}
                        </p>
                      </div>
                      {tool?.requiresAuth &&
                        (connected ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => void disconnectTool(slug)}
                          >
                            Disconnect
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => void connectTool(slug)}
                          >
                            Connect
                          </Button>
                        ))}
                    </div>
                  );
                })}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {currentDraft.skills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="configuration">
          <Card>
            <CardContent className="space-y-6 p-6">
              <AgentConfigForm
                draft={currentDraft}
                onChange={setDraft}
                connections={connections}
                onConnect={connectTool}
                onDisconnect={disconnectTool}
              />
              <div className="flex justify-end gap-2 border-t border-border/70 pt-4">
                <Button variant="outline" onClick={() => setDraft(null)}>
                  Reset
                </Button>
                <Button className="gap-2" onClick={save} disabled={saving}>
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat">
          <Card className="flex h-[640px] flex-col">
            <CardContent className="flex min-h-0 flex-1 flex-col p-6">
              <AgentChat agent={agent} className="min-h-0 flex-1" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Run history</CardTitle>
              <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
                <Link href={`/dashboard/runs?agentId=${agentId}`}>
                  Open full log
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {runs.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No runs yet — hit “Run now” to see one.
                </p>
              ) : (
                runs.map((run) => (
                  <Link
                    key={run.id}
                    href={`/dashboard/runs/${run.id}`}
                    className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 transition hover:border-primary/30 hover:bg-muted/40"
                  >
                    <StatusBadge status={run.status} />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm text-muted-foreground">
                        {run.error ??
                          (run.output
                            ? truncate(
                                run.output.replace(/[#>*_`-]/g, " ").replace(/\s+/g, " "),
                                110,
                              )
                            : `Scheduled for ${shortDateTime(run.scheduleFor)}`)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {relativeTime(run.createdAt)}
                    </span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-medium">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
