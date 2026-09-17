"use client";

import { useState } from "react";
import {
  Check,
  Plus,
  RefreshCw,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToolIcon } from "@/components/shared/tool-icon";
import { TOOL_CATALOG, toolBySlug } from "@/agent/tools/catalog";
import { avatarUrl } from "@/lib/avatar";
import type { ScheduleConfig } from "@/db/schema";

export interface AgentDraft {
  agentId?: string;
  name: string;
  description: string;
  objective: string;
  instructions: string;
  tools: string[];
  skills: string[];
  schedule: ScheduleConfig;
  outputFormat: string;
  telegramChatId?: string;
  agentImage?: string;
  status?: string;
}

export interface ToolConnectionInfo {
  slug: string;
  connected: boolean;
  accountLabel: string | null;
}

export function AgentConfigForm({
  draft,
  onChange,
  connections,
  onConnect,
  onDisconnect,
  compact = false,
}: {
  draft: AgentDraft;
  onChange: (draft: AgentDraft) => void;
  connections: ToolConnectionInfo[];
  onConnect: (slug: string) => void;
  onDisconnect: (slug: string) => void;
  compact?: boolean;
}) {
  const [skillInput, setSkillInput] = useState("");
  const [toolPickerOpen, setToolPickerOpen] = useState(false);

  const update = (patch: Partial<AgentDraft>) => onChange({ ...draft, ...patch });
  const connectionFor = (slug: string) =>
    connections.find((connection) => connection.slug === slug);

  const schedule = draft.schedule ?? { type: "manual", time: "09:00" };

  const setSchedule = (patch: Partial<ScheduleConfig>) =>
    update({ schedule: { ...schedule, ...patch } });

  const addSkill = () => {
    const value = skillInput.trim();
    if (!value || draft.skills.includes(value)) return;
    update({ skills: [...draft.skills, value] });
    setSkillInput("");
  };

  const availableTools = TOOL_CATALOG.filter((tool) => !draft.tools.includes(tool.slug));

  return (
    <div className="space-y-6">
      {/* Identity */}
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center gap-2">
          <Avatar className="size-16 rounded-xl border border-border">
            <AvatarImage
              src={draft.agentImage ?? avatarUrl(draft.agentId ?? draft.name, draft.name)}
              alt={draft.name}
            />
            <AvatarFallback className="rounded-md bg-muted text-lg text-muted-foreground">
              {draft.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-[11px]"
            onClick={() =>
              update({
                agentImage: avatarUrl(
                  `${draft.agentId ?? draft.name}-${Date.now()}`,
                  draft.name,
                ),
              })
            }
          >
            <RefreshCw className="size-3" />
            Shuffle
          </Button>
        </div>
        <div className="flex-1 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="agent-name">Agent name</Label>
            <Input
              id="agent-name"
              value={draft.name}
              onChange={(event) => update({ name: event.target.value })}
              name="agent-name"
              autoComplete="off"
              placeholder="Reddit Trend Radar"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-description">Description</Label>
            <Textarea
              id="agent-description"
              value={draft.description}
              onChange={(event) => update({ description: event.target.value })}
              name="agent-description"
              autoComplete="off"
              placeholder="One sentence a non-technical teammate understands"
              className="min-h-[60px] resize-none"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Objective + instructions */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="agent-objective">Objective</Label>
          <Textarea
            id="agent-objective"
            value={draft.objective}
            onChange={(event) => update({ objective: event.target.value })}
            name="agent-objective"
            autoComplete="off"
            placeholder="The measurable outcome of every run"
            className="min-h-[120px]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="agent-instructions">Instructions</Label>
          <Textarea
            id="agent-instructions"
            value={draft.instructions}
            onChange={(event) => update({ instructions: event.target.value })}
            name="agent-instructions"
            autoComplete="off"
            placeholder="Numbered steps the agent follows"
            className="min-h-[120px] font-mono text-xs leading-relaxed"
          />
        </div>
      </div>

      {/* Schedule */}
      <div className="space-y-3" role="group" aria-labelledby="schedule-label">
        <Label id="schedule-label">Schedule</Label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            value={schedule.type}
            onValueChange={(value) =>
              setSchedule({
                type: value as ScheduleConfig["type"],
                frequency:
                  value === "recurring" ? (schedule.frequency ?? "daily") : null,
              })
            }
          >
            <SelectTrigger aria-label="Schedule type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">On demand</SelectItem>
              <SelectItem value="once">Once</SelectItem>
              <SelectItem value="recurring">Recurring</SelectItem>
            </SelectContent>
          </Select>

          {schedule.type !== "manual" && (
            <Input
              type="time"
              value={schedule.time}
              onChange={(event) => setSchedule({ time: event.target.value })}
              name="schedule-time"
              aria-label="Run time"
            />
          )}

          {schedule.type === "recurring" && (
            <Select
              value={schedule.frequency ?? "daily"}
              onValueChange={(value) =>
                setSchedule({
                  frequency: value as ScheduleConfig["frequency"],
                })
              }
            >
              <SelectTrigger aria-label="Frequency">
                <SelectValue placeholder="Frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          )}

          {schedule.type === "recurring" && schedule.frequency === "weekly" && (
            <Select
              value={String(schedule.dayOfWeek ?? 1)}
              onValueChange={(value) => setSchedule({ dayOfWeek: Number(value) })}
            >
              <SelectTrigger aria-label="Day of week">
                <SelectValue placeholder="Day" />
              </SelectTrigger>
              <SelectContent>
                {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(
                  (day, index) => (
                    <SelectItem key={day} value={String(index)}>
                      {day}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          )}

          {schedule.type === "recurring" && schedule.frequency === "monthly" && (
            <Input
              type="number"
              min={1}
              max={31}
              value={schedule.dayOfMonth ?? 1}
              onChange={(event) =>
                setSchedule({ dayOfMonth: Number(event.target.value) || 1 })
              }
              name="day-of-month"
              aria-label="Day of month"
              placeholder="Day of month"
            />
          )}

          {schedule.type === "once" && (
            <Input
              type="date"
              value={schedule.date ?? ""}
              onChange={(event) => setSchedule({ date: event.target.value })}
              name="run-date"
              aria-label="Run date"
            />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Time zone: {schedule.timeZone ?? "UTC"} (detected from your browser)
        </p>
      </div>

      {/* Skills */}
      <div className="space-y-3">
        <Label htmlFor="agent-skill-input">Skills</Label>
        <div className="flex flex-wrap gap-2">
          {draft.skills.map((skill) => (
            <Badge
              key={skill}
              variant="secondary"
              className="gap-1.5 py-1 pl-2.5 pr-1.5 text-xs"
            >
              {skill}
              <button
                type="button"
                className="rounded-full p-0.5 transition hover:bg-background/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                aria-label={`Remove skill ${skill}`}
                onClick={() => update({ skills: draft.skills.filter((s) => s !== skill) })}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            id="agent-skill-input"
            value={skillInput}
            onChange={(event) => setSkillInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addSkill();
              }
            }}
            name="skill"
            autoComplete="off"
            placeholder="Add a skill…"
            className="h-9"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            aria-label="Add skill"
            onClick={addSkill}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {/* Tools */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-medium leading-none select-none">
            <Wrench className="size-3.5" />
            Connected tools
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setToolPickerOpen((value) => !value)}
          >
            <Plus className="size-3.5" />
            Add tool
          </Button>
        </div>

        {toolPickerOpen && availableTools.length > 0 && (
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border/70 bg-muted/20 p-2">
            {availableTools.map((tool) => (
              <button
                key={tool.slug}
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left text-sm transition hover:bg-background"
                onClick={() => {
                  update({ tools: [...draft.tools, tool.slug] });
                  setToolPickerOpen(false);
                }}
              >
                <div
                  className="flex size-7 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${tool.color}1a` }}
                >
                  <ToolIcon name={tool.icon} slug={tool.slug} color={tool.color} className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{tool.name}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {tool.description}
                  </p>
                </div>
                <Badge variant="outline" className="text-[11px]">
                  {tool.requiresAuth ? "OAuth" : "Built-in"}
                </Badge>
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          {draft.tools.map((slug) => {
            const tool = toolBySlug.get(slug);
            if (!tool) return null;
            const connection = connectionFor(slug);
            const connected = !tool.requiresAuth || connection?.connected;
            return (
              <div
                key={slug}
                className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/20 p-3"
              >
                <div
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${tool.color}1a` }}
                >
                  <ToolIcon name={tool.icon} slug={tool.slug} color={tool.color} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{tool.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {connected
                      ? tool.requiresAuth
                        ? (connection?.accountLabel ?? "Connected")
                        : "Always available"
                      : "Not connected"}
                  </p>
                </div>
                {tool.requiresAuth &&
                  (connected ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => onDisconnect(slug)}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => onConnect(slug)}
                    >
                      <ShieldCheck className="size-3" />
                      Connect
                    </Button>
                  ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground"
                  aria-label={`Remove ${tool.name}`}
                  onClick={() => update({ tools: draft.tools.filter((t) => t !== slug) })}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Output format */}
      <div className="space-y-2">
        <Label htmlFor="agent-output">Output format</Label>
        <Textarea
          id="agent-output"
          value={draft.outputFormat}
          onChange={(event) => update({ outputFormat: event.target.value })}
          name="agent-output"
          autoComplete="off"
          placeholder="How the final deliverable should look"
          className={compact ? "min-h-[60px]" : "min-h-[80px]"}
        />
      </div>

      {draft.tools.includes("telegram") && (
        <div className="space-y-2">
          <Label htmlFor="telegram-chat-id">Telegram chat ID</Label>
          <Input
            id="telegram-chat-id"
            value={draft.telegramChatId ?? ""}
            onChange={(event) => update({ telegramChatId: event.target.value })}
            name="telegram-chat-id"
            autoComplete="off"
            inputMode="numeric"
            placeholder="e.g. 7979789225"
            className="max-w-xs"
          />
          <p className="text-xs text-muted-foreground">
            Where the agent sends Telegram messages and where the
            &ldquo;run finished&rdquo; notification goes. Message your bot once, then
            copy the chat ID from @userinfobot on Telegram.
          </p>
        </div>
      )}

      {draft.schedule?.type === "recurring" && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-3 text-xs text-emerald-700 dark:text-emerald-400">
          <Check className="size-3.5 shrink-0" />
          The agent will run automatically {draft.schedule.frequency} at{" "}
          {draft.schedule.time} ({draft.schedule.timeZone ?? "UTC"}) and every step will be
          logged under Runs.
        </div>
      )}
    </div>
  );
}
