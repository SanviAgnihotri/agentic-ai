"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowUp,
  CheckCircle2,
  Loader2,
  Plus,
  RotateCcw,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { useReducedMotion } from "motion/react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AgentConfigForm, type AgentDraft, type ToolConnectionInfo } from "./agent-config-form";
import { ClarificationWizard } from "./clarification-wizard";
import { StatusBadge } from "@/components/shared/status-badge";
import { iconFor, ToolIcon, brandSlugForToolNames } from "@/components/shared/tool-icon";
import { agentTemplates } from "@/agent/config/templates";
import { quickSuggestions } from "@/agent/config/quick-suggestions";
import type { ClarificationQuestion } from "@/agent/config/response-schema";
import { apiFetch } from "@/hooks/use-poll";
import { describeSchedule } from "@/agent/schedule";

export interface AgentRow {
  id: number;
  userEmail: string | null;
  agentId: string;
  name: string | null;
  agentImage: string | null;
  description: string | null;
  instructions: string | null;
  objective: string | null;
  tools: string[] | null;
  skills: string[] | null;
  schedule: AgentDraft["schedule"] | null;
  outputFormat: string | null;
  status: string | null;
  composioSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

type Phase = "idle" | "generating" | "clarifying" | "ready";

const GENERATING_STEPS = [
  "Reading your request…",
  "Choosing the right tools…",
  "Drafting objective and instructions…",
  "Building the execution schedule…",
  "Finalizing your agent…",
];

export function CreateAgent({
  initialPrompt,
  onCreated,
  onViewMyAgents,
}: {
  initialPrompt?: string;
  onCreated?: (agent: AgentRow) => void;
  onViewMyAgents?: () => void;
}) {
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const [lastInitialPrompt, setLastInitialPrompt] = useState(initialPrompt);
  if (initialPrompt !== undefined && initialPrompt !== lastInitialPrompt) {
    setLastInitialPrompt(initialPrompt);
    setPrompt(initialPrompt);
  }
  const [phase, setPhase] = useState<Phase>("idle");
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [draft, setDraft] = useState<AgentDraft | null>(null);
  const [draftBaseline, setDraftBaseline] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState<"new" | "view" | null>(null);
  const [connections, setConnections] = useState<ToolConnectionInfo[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);

  const draftDirty =
    draft !== null && draftBaseline !== null && JSON.stringify(draft) !== draftBaseline;

  const timeZone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      : "UTC";

  useEffect(() => {
    if (phase !== "generating") return;
    const timer = setInterval(
      () => setStepIndex((value) => Math.min(value + 1, GENERATING_STEPS.length - 1)),
      900,
    );
    return () => clearInterval(timer);
  }, [phase]);

  const loadConnections = useCallback(async (agentId: string) => {
    try {
      const data = await apiFetch<{ tools: ToolConnectionInfo[] }>(
        `/api/agent/tools?agentId=${encodeURIComponent(agentId)}`,
      );
      setConnections(data.tools ?? []);
    } catch {
      setConnections([]);
    }
  }, []);

  const toDraft = (row: AgentRow): AgentDraft => ({
    agentId: row.agentId,
    name: row.name ?? "Untitled agent",
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

  const handleReady = (row: AgentRow) => {
    const nextDraft = toDraft(row);
    setAgent(row);
    setDraft(nextDraft);
    setDraftBaseline(JSON.stringify(nextDraft));
    setPhase("ready");
    void loadConnections(row.agentId);
    onCreated?.(row);
  };

  const submitPrompt = async () => {
    const value = prompt.trim();
    if (!value) {
      toast.error("Describe the agent you want to create");
      return;
    }
    setSubmitting(true);
    setStepIndex(0);
    setPhase("generating");
    try {
      const result = await apiFetch<{
        status: "needs_clarification" | "ready";
        clarificationQuestions?: ClarificationQuestion[];
        agent?: AgentRow;
        error?: string;
      }>("/api/agent/configure", {
        method: "POST",
        json: { prompt: value, timeZone },
      });
      if (result.status === "needs_clarification") {
        setQuestions(result.clarificationQuestions ?? []);
        setPhase("clarifying");
      } else if (result.agent) {
        handleReady(result.agent);
        toast.success("Agent created", {
          description: `“${result.agent.name}” is ready to run.`,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate the agent");
      setPhase("idle");
    } finally {
      setSubmitting(false);
    }
  };

  const completeClarification = async (answers: Record<string, string>) => {
    setSubmitting(true);
    setStepIndex(0);
    setPhase("generating");
    try {
      const result = await apiFetch<{
        status: "needs_clarification" | "ready";
        clarificationQuestions?: ClarificationQuestion[];
        agent?: AgentRow;
      }>("/api/agent/configure", {
        method: "POST",
        json: { prompt: prompt.trim(), answers, timeZone },
      });
      if (result.status === "ready" && result.agent) {
        handleReady(result.agent);
        toast.success("Agent created", {
          description: `“${result.agent.name}” is ready to run.`,
        });
      } else {
        setQuestions(result.clarificationQuestions ?? []);
        setPhase("clarifying");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate the agent");
      setPhase("clarifying");
    } finally {
      setSubmitting(false);
    }
  };

  const saveChanges = async () => {
    if (!draft?.agentId) return;
    setSaving(true);
    try {
      await apiFetch(`/api/agents/${draft.agentId}`, {
        method: "PATCH",
        json: {
          name: draft.name,
          description: draft.description,
          objective: draft.objective,
          instructions: draft.instructions,
          tools: draft.tools,
          skills: draft.skills,
          schedule: draft.schedule,
          outputFormat: draft.outputFormat,
          agentImage: draft.agentImage,
        },
      });
      toast.success("Agent updated");
      await loadConnections(draft.agentId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the agent");
    } finally {
      setSaving(false);
    }
  };

  const connectTool = async (slug: string) => {
    if (!draft?.agentId) return;
    try {
      const result = await apiFetch<{ redirectUrl: string | null; connected: boolean }>(
        "/api/agent/tools/connect",
        { method: "POST", json: { toolSlug: slug, agentId: draft.agentId } },
      );
      if (result.redirectUrl) {
        window.open(result.redirectUrl, "_blank", "noopener,noreferrer");
        toast.info("Finish the connection in the new tab, then refresh.");
      } else {
        toast.success("Integration connected");
        await loadConnections(draft.agentId);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not connect");
    }
  };

  const disconnectTool = async (slug: string) => {
    if (!draft?.agentId) return;
    try {
      await apiFetch("/api/agent/tools/connect", {
        method: "DELETE",
        json: { toolSlug: slug, agentId: draft.agentId },
      });
      toast.success("Integration disconnected");
      await loadConnections(draft.agentId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect");
    }
  };

  const reset = () => {
    setPhase("idle");
    setAgent(null);
    setDraft(null);
    setDraftBaseline(null);
    setConfirmLeave(null);
    setQuestions([]);
    setPrompt("");
  };

  // Ready-phase exits guard unsaved config edits.
  const leaveReady = (target: "new" | "view") => {
    if (draftDirty) {
      setConfirmLeave(target);
      return;
    }
    if (target === "new") {
      reset();
      return;
    }
    if (agent) onCreated?.(agent);
    onViewMyAgents?.();
  };

  if (phase === "clarifying" && questions.length > 0) {
    return (
      <div ref={scrollRef}>
        <h1 className="sr-only">Create a new agent</h1>
        <ClarificationWizard
          questions={questions}
          onComplete={completeClarification}
          onBack={reset}
          submitting={submitting}
        />
      </div>
    );
  }

  if (phase === "generating") {
    return (
      <Card className="mx-auto w-full max-w-2xl">
        <h1 className="sr-only">Create a new agent</h1>
        <CardContent className="flex flex-col items-center gap-6 p-10 text-center">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-primary/20 motion-reduce:animate-none" />
            <div className="relative flex size-16 items-center justify-center rounded-full bg-muted">
              <Wand2 className="size-7 text-primary" />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Generating your agent</h2>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {GENERATING_STEPS[stepIndex]}
            </p>
          </div>
          <div className="flex gap-1.5">
            {GENERATING_STEPS.map((step, index) => (
              <span
                key={step}
                className={`h-1.5 w-8 rounded-full transition ${
                  index <= stepIndex ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "ready" && draft && agent) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <h1 className="sr-only">Create a new agent</h1>
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="flex flex-wrap items-center gap-4 p-5">
            <Avatar className="size-14 rounded-xl border border-border">
              <AvatarImage src={draft.agentImage} alt={draft.name} />
              <AvatarFallback className="rounded-md bg-muted text-muted-foreground">
                {draft.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-semibold">{draft.name}</h2>
                <StatusBadge status={agent.status ?? "active"} kind="agent" />
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {describeSchedule(draft.schedule)} · {draft.tools.length} tools ·{" "}
                {draft.skills.length} skills
              </p>
            </div>
            <Badge variant="outline" className="gap-1.5 border-emerald-500/25 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" />
              Agent created
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <AgentConfigForm
              draft={draft}
              onChange={setDraft}
              connections={connections}
              onConnect={connectTool}
              onDisconnect={disconnectTool}
            />
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <Button variant="ghost" className="gap-2" onClick={() => leaveReady("new")}>
            <RotateCcw className="size-4" />
            Create another
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => leaveReady("view")}>
              View in My Agents
            </Button>
            <Button className="gap-2" onClick={saveChanges} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Save agent
            </Button>
          </div>
        </div>

        <AlertDialog
          open={confirmLeave !== null}
          onOpenChange={(open) => {
            if (!open) setConfirmLeave(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
              <AlertDialogDescription>
                Your edits to {draft.name} haven’t been saved. Save the agent first
                to keep them.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep editing</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => {
                  const target = confirmLeave;
                  setConfirmLeave(null);
                  if (target === "new") reset();
                  else {
                    onCreated?.(agent);
                    onViewMyAgents?.();
                  }
                }}
              >
                Discard changes
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Create a new agent
        </h1>
        <p className="text-muted-foreground">
          Describe the outcome you want. Groovy builds the objective, instructions, tools
          and schedule for you.
        </p>
      </div>

      {/* Prompt composer */}
      <div className="rounded-xl border border-border bg-card p-2 transition-colors focus-within:border-ring">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void submitPrompt();
            }
          }}
          name="prompt"
          aria-label="Describe the agent you want"
          autoComplete="off"
          placeholder="e.g. Find the top 5 trending AI topics on Reddit, summarize them into a Google Doc and notify me on Slack every day at 8am…"
          className="min-h-[120px] w-full resize-none bg-transparent p-4 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/70"
        />
        <div className="flex items-center justify-end gap-2 px-3 pb-2">
          <Button
            size="icon"
            className="size-9 rounded-full bg-primary"
            aria-label="Create agent from this description"
            onClick={() => void submitPrompt()}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Quick suggestions */}
      <div className="flex flex-wrap justify-center gap-2">
        {quickSuggestions.map((suggestion) => {
          const Icon = iconFor(suggestion.icon);
          return (
            <button
              key={suggestion.label}
              onClick={() => setPrompt(suggestion.prompt)}
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            >
              <Icon className="size-3.5" />
              {suggestion.label}
            </button>
          );
        })}
      </div>

      {/* Templates */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Or start from a template</h2>
          <span className="text-xs text-muted-foreground">
            Click one to load it into the composer
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agentTemplates.slice(0, 6).map((template) => {
            const Icon = iconFor(template.icon);
            const brandSlug = brandSlugForToolNames(template.tools);
            return (
              <button
                key={template.id}
                onClick={() => {
                  setPrompt(template.prompt);
                  window.scrollTo({
                    top: 0,
                    behavior: reducedMotion ? "auto" : "smooth",
                  });
                }}
                className={`group rounded-xl border border-border/70 bg-card p-5 text-left transition-colors hover:border-foreground/15 `}
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  {brandSlug ? (
                    <ToolIcon name={null} slug={brandSlug} className="size-5" />
                  ) : (
                    <Icon className="size-5 text-muted-foreground" />
                  )}
                </div>
                <h3 className="mt-3 font-semibold">{template.title}</h3>
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {template.description}
                </p>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Plus className="size-3 opacity-0 transition group-hover:opacity-100" />
                  {template.schedule}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 pb-6 text-xs text-muted-foreground">
        <Image src="/logo.svg" alt="" width={16} height={16} />
        Your agent runs on a schedule — even while you sleep.
      </div>
    </div>
  );
}
