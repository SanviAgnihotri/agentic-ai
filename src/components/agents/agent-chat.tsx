"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/shared/markdown";
import { apiFetch } from "@/hooks/use-poll";
import { cn } from "@/lib/utils";
import type { AgentWithRuns } from "./agent-card";

interface ChatMessageItem {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  created?: string;
}

const SUGGESTIONS = [
  "What can you do?",
  "Show me your latest result",
  "When do you run next?",
  "Did you send the notification?",
];

export function AgentChat({
  agent,
  className,
  compact = false,
}: {
  agent: AgentWithRuns;
  className?: string;
  compact?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [input, setInput] = useState("");
  const [replying, setReplying] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async (agentId: string) => {
    setLoading(true);
    try {
      const data = await apiFetch<{
        messages: Array<{ id: number; role: string; content: string; createdAt: string }>;
      }>(`/api/agent/run?agentId=${encodeURIComponent(agentId)}`);
      setMessages(
        data.messages
          .filter((message) => message.role === "user" || message.role === "assistant")
          .map((message) => ({
            id: message.id,
            role: message.role as "user" | "assistant",
            content: message.content,
            created: message.createdAt,
          })),
      );
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory(agent.agentId);
  }, [agent.agentId, loadHistory]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, replying]);

  const send = async (value: string) => {
    const text = value.trim();
    if (!text) return;
    setMessages((previous) => [
      ...previous,
      { id: `local-${Date.now()}`, role: "user", content: text },
    ]);
    setInput("");
    setReplying(true);
    try {
      const result = await apiFetch<{ reply: string }>("/api/agent/run", {
        method: "POST",
        json: { agentId: agent.agentId, input: text, mode: "chat" },
      });
      setMessages((previous) => [
        ...previous,
        { id: `reply-${Date.now()}`, role: "assistant", content: result.reply },
      ]);
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `⚠️ ${
            error instanceof Error ? error.message : "I could not complete that request."
          }`,
        },
      ]);
    } finally {
      setReplying(false);
    }
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex-1 space-y-5 overflow-y-auto px-1 py-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="size-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Hi! I&apos;m {agent.name}.</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {agent.description ??
                  "Ask me about my schedule, my tools or my latest results."}
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn("flex gap-3", message.role === "user" && "flex-row-reverse")}
            >
              {message.role === "assistant" && (
                <Avatar className="mt-0.5 size-7 shrink-0 rounded-lg border border-border">
                  <AvatarImage src={agent.agentImage ?? undefined} alt="" />
                  <AvatarFallback className="rounded-md bg-muted text-muted-foreground">
                    <Bot className="size-3.5" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-4 py-2.5 text-sm",
                  message.role === "user"
                    ? "rounded-tr-sm bg-primary text-primary-foreground"
                    : "rounded-tl-sm border border-border/70 bg-muted/30",
                )}
              >
                {message.role === "assistant" ? (
                  <Markdown>{message.content}</Markdown>
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}
              </div>
            </div>
          ))
        )}
        {replying && (
          <div className="flex gap-3">
            <Avatar className="mt-0.5 size-7 shrink-0 rounded-lg border border-border">
              <AvatarFallback className="rounded-md bg-muted text-muted-foreground">
                <Bot className="size-3.5" />
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-1 rounded-xl rounded-tl-sm border border-border/70 bg-muted/30 px-4 py-3">
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length < 3 && !loading && (
        <div className="flex flex-wrap gap-2 pb-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => void send(suggestion)}
              disabled={replying}
              className="rounded-full border border-border/70 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <div className={cn("relative", !compact && "border-t border-border/70 pt-4")}>
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(input);
            }
          }}
          placeholder={`Ask ${agent.name} anything…`}
          className="min-h-[52px] resize-none pr-12"
          disabled={replying}
        />
        <Button
          size="icon"
          className="absolute right-2 bottom-2 size-8 rounded-full"
          onClick={() => void send(input)}
          disabled={replying || !input.trim()}
        >
          {replying ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}
