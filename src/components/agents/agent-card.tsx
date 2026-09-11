"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  CalendarClock,
  Loader2,
  MessageSquare,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  PlayCircle,
  Trash2,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/shared/status-badge";
import { ToolIcon } from "@/components/shared/tool-icon";
import { toolBySlug } from "@/agent/tools/catalog";
import { describeSchedule } from "@/agent/schedule";
import { relativeTime, shortDateTime } from "@/lib/format";
import { apiFetch } from "@/hooks/use-poll";
import type { AgentRow } from "./create-agent";

export interface AgentWithRuns extends AgentRow {
  nextRun?: {
    id: number;
    scheduleFor: string;
  } | null;
  lastRun?: {
    id: number;
    status: string;
    createdAt: string;
    completedAt: string | null;
  } | null;
  runCount?: number;
}

export function AgentCard({
  agent,
  onChanged,
  onChat,
  onEdit,
}: {
  agent: AgentWithRuns;
  onChanged: () => void;
  onChat: (agent: AgentWithRuns) => void;
  onEdit: (agent: AgentWithRuns) => void;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const runNow = async () => {
    setRunning(true);
    try {
      const result = await apiFetch<{ runId: number }>("/api/agent/run", {
        method: "POST",
        json: { agentId: agent.agentId, mode: "run" },
      });
      toast.success("Agent started", {
        description: "Live execution log is opening…",
      });
      router.push(`/dashboard/runs/${result.runId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the agent");
    } finally {
      setRunning(false);
    }
  };

  const toggleStatus = async () => {
    const next = agent.status === "active" ? "paused" : "active";
    try {
      await apiFetch(`/api/agents/${agent.agentId}`, {
        method: "PATCH",
        json: { status: next },
      });
      toast.success(next === "paused" ? "Agent paused" : "Agent resumed");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the agent");
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await apiFetch(`/api/agents/${agent.agentId}`, { method: "DELETE" });
      toast.success("Agent deleted");
      setConfirmDelete(false);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the agent");
    } finally {
      setDeleting(false);
    }
  };

  const tools = (agent.tools ?? []).map((slug) => toolBySlug.get(slug)).filter(Boolean);

  return (
    <>
      <Card className="group flex flex-col border-border/70 transition hover:border-foreground/15">
        <CardContent className="flex flex-1 flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            <Avatar className="size-11 rounded-xl border border-border">
              <AvatarImage src={agent.agentImage ?? undefined} alt={agent.name ?? "Agent"} />
              <AvatarFallback className="rounded-md bg-muted text-muted-foreground">
                <Bot className="size-5" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-semibold">{agent.name}</h3>
                <StatusBadge status={agent.status} kind="agent" />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {agent.lastRun
                  ? `Last run ${relativeTime(agent.lastRun.createdAt)}`
                  : "No runs yet"}
                {typeof agent.runCount === "number" && ` · ${agent.runCount} runs`}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => void runNow()}>
                  <Play className="size-4" />
                  Run now
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onChat(agent)}>
                  <MessageSquare className="size-4" />
                  Chat with agent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(agent)}>
                  <Pencil className="size-4" />
                  Edit agent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void toggleStatus()}>
                  <Pause className="size-4" />
                  {agent.status === "active" ? "Pause agent" : "Resume agent"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    router.push(`/dashboard/runs?agentId=${agent.agentId}`)
                  }
                >
                  <PlayCircle className="size-4" />
                  View runs
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" />
                  Delete agent
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <p className="line-clamp-2 min-h-[40px] text-sm text-muted-foreground">
            {agent.description}
          </p>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary" className="gap-1.5 font-normal">
              <CalendarClock className="size-3" />
              {agent.schedule?.type === "manual"
                ? "On demand"
                : describeSchedule(agent.schedule)}
            </Badge>
            {agent.nextRun && agent.status === "active" && (
              <Badge variant="outline" className="gap-1.5 font-normal text-sky-600 dark:text-sky-400">
                Next {shortDateTime(agent.nextRun.scheduleFor)}
              </Badge>
            )}
          </div>

          {tools.length > 0 && (
            <div className="flex items-center gap-1.5">
              {tools.slice(0, 6).map((tool) => (
                <Tooltip key={tool!.slug}>
                  <TooltipTrigger asChild>
                    <div className="flex size-7 items-center justify-center rounded-lg border border-border/60 bg-muted">
                      <ToolIcon name={tool!.icon} slug={tool!.slug} color={tool!.color} className="size-3.5" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{tool!.name}</TooltipContent>
                </Tooltip>
              ))}
              {tools.length > 6 && (
                <span className="text-xs text-muted-foreground">+{tools.length - 6}</span>
              )}
            </div>
          )}

          <div className="mt-auto flex gap-2 pt-2">
            <Button
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => void runNow()}
              disabled={running}
            >
              {running ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5" />
              )}
              Run agent
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-1.5"
              onClick={() => onChat(agent)}
            >
              <MessageSquare className="size-3.5" />
              Chat
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => router.push(`/dashboard/agents/${agent.agentId}`)}
            >
              Open
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{agent.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the agent, its schedule, chat history and all
              run logs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete agent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
