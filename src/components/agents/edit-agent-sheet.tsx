"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AgentConfigForm,
  type AgentDraft,
  type ToolConnectionInfo,
} from "./agent-config-form";
import { apiFetch } from "@/hooks/use-poll";
import type { AgentWithRuns } from "./agent-card";

export function EditAgentSheet({
  agent,
  open,
  onOpenChange,
  onSaved,
}: {
  agent: AgentWithRuns | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<AgentDraft | null>(null);
  const [connections, setConnections] = useState<ToolConnectionInfo[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!agent || !open) return;
    setDraft({
      agentId: agent.agentId,
      name: agent.name ?? "",
      description: agent.description ?? "",
      objective: agent.objective ?? "",
      instructions: agent.instructions ?? "",
      tools: agent.tools ?? [],
      skills: agent.skills ?? [],
      schedule: agent.schedule ?? { type: "manual", time: "09:00" },
      outputFormat: agent.outputFormat ?? "",
      agentImage: agent.agentImage ?? undefined,
      status: agent.status ?? "active",
    });
  }, [agent, open]);

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

  useEffect(() => {
    if (agent && open) void loadConnections(agent.agentId);
  }, [agent, open, loadConnections]);

  const save = async () => {
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
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the agent");
    } finally {
      setSaving(false);
    }
  };

  const connectTool = async (slug: string) => {
    if (!draft?.agentId) return;
    try {
      const result = await apiFetch<{ redirectUrl: string | null }>(
        "/api/agent/tools/connect",
        { method: "POST", json: { toolSlug: slug, agentId: draft.agentId } },
      );
      if (result.redirectUrl) {
        window.open(result.redirectUrl, "_blank", "noopener,noreferrer");
        toast.info("Finish the connection in the new tab.");
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Pencil className="size-4 text-primary" />
            Edit agent
          </SheetTitle>
          <SheetDescription>
            Update the configuration, reconnect tools and adjust the schedule. Changes
            are applied to future runs immediately.
          </SheetDescription>
        </SheetHeader>
        {draft && (
          <div className="space-y-6 px-4 pb-6">
            <AgentConfigForm
              draft={draft}
              onChange={setDraft}
              connections={connections}
              onConnect={connectTool}
              onDisconnect={disconnectTool}
            />
            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border/70 bg-background/95 py-3 backdrop-blur">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button className="gap-2" onClick={save} disabled={saving}>
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Save changes
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
