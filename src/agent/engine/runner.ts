import type { RunStep } from "@/db/schema";
import {
  buildExecutionInstructions,
  CHAT_SYSTEM_PROMPT,
  RUNNER_SYSTEM_PROMPT,
} from "@/agent/config/prompts";
import { getLlm } from "@/agent/ai";
import type { ChatMessage } from "@/agent/ai/types";
import { buildAgentToolset, toLlmToolSpecs } from "@/agent/tools/runtime";

export interface RunnerAgent {
  agentId: string;
  name?: string | null;
  description?: string | null;
  objective?: string | null;
  instructions?: string | null;
  skills?: string[] | null;
  outputFormat?: string | null;
  tools?: string[] | null;
  composioSessionId?: string | null;
}

export interface RunnerResult {
  status: "completed" | "failed" | "cancelled";
  output: string;
  steps: RunStep[];
  error?: string;
  creditsUsed: number;
  liveUrl?: string | null;
}

/** Thrown when the user stops a run mid-flight. */
export class RunCancelledError extends Error {
  constructor() {
    super("Run cancelled by user");
    this.name = "RunCancelledError";
  }
}

/** Reject if `promise` does not settle within `ms` (timer is cleaned up). */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
    timer.unref?.();
  });
  return Promise.race([
    promise.finally(() => timer && clearTimeout(timer)),
    timeout,
  ]);
}

/** DeepSeek sometimes leaks its tool-call XML into the final answer. */
function looksLikeToolSyntax(text: string): boolean {
  const head = text.trim().slice(0, 160).toLowerCase();
  return (
    head.startsWith("<tool_call") ||
    head.startsWith("<tool_calls") ||
    head.startsWith("<invoke") ||
    head.startsWith("<function_call") ||
    head.startsWith('{"tool') ||
    head.startsWith('[{"tool')
  );
}

/**
 * If the model echoed a tool call as text, recover the deliverable payload from
 * its parameters when possible; otherwise return null so the runner synthesizes
 * a clean final answer from the real tool results.
 */
function recoverFinalText(text: string): string | null {
  if (!looksLikeToolSyntax(text)) return text.trim() || null;
  const matches = Array.from(
    text.matchAll(
      /<parameter\s+name="(?:message|text|content|body)"[^>]*>([\s\S]*?)<\/parameter>/gi,
    ),
  );
  const longest = matches
    .map((match) => match[1].trim())
    .sort((a, b) => b.length - a.length)[0];
  return longest && longest.length >= 160 ? longest : null;
}

export interface ExecuteAgentOptions {
  userEmail: string;
  agent: RunnerAgent;
  input: string;
  maxSteps?: number;
  /** Current run id (lets the scheduler signal cancellation between steps). */
  runId?: number;
  /** Polled before every step; return true to stop the run gracefully. */
  shouldCancel?: () => boolean;
  /** "run" executes the objective; "chat" answers conversationally and only
   *  calls tools when the user asks for fresh information or an action. */
  mode?: "run" | "chat";
  /** Recent runs rendered into the prompt/mock context for chat answers. */
  runs?: Array<Record<string, unknown>>;
  /** Called with the full, updated step list after every step. */
  onSteps?: (steps: RunStep[]) => void | Promise<void>;
  /** Extra conversation history for chat mode. */
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export async function executeAgent(options: ExecuteAgentOptions): Promise<RunnerResult> {
  const llm = getLlm();
  const steps: RunStep[] = [];
  let liveUrl: string | null = null;
  let creditsUsed = 0;

  const emit = async (step: Omit<RunStep, "index" | "at">) => {
    const full: RunStep = {
      index: steps.length,
      at: new Date().toISOString(),
      ...step,
    };
    steps.push(full);
    await options.onSteps?.(steps);
  };

  try {
    const toolset = await buildAgentToolset({
      userEmail: options.userEmail,
      agent: options.agent,
    });
    const specs = toLlmToolSpecs(toolset);

    await emit({
      type: "info",
      title: "Run started",
      detail: `Engine: ${llm.label} (${llm.model}) · ${specs.length} tool${
        specs.length === 1 ? "" : "s"
      } available`,
    });

    const integrationRules: string[] = [];
    if (toolset.connectedTools.length > 0) {
      integrationRules.push(
        `Connected integrations: ${toolset.connectedTools
          .map((tool) => tool.name)
          .join(", ")}. These are already authorized — use them directly and NEVER ask the user which service or account to use when one of them fits the task.`,
      );
    }
    if (toolset.missingTools.length > 0) {
      integrationRules.push(
        `NOT connected: ${toolset.missingTools
          .map((tool) => tool.name)
          .join(", ")}. Their tools are unavailable. Do not fabricate results for them. If the objective depends on one, complete the rest of the work and clearly tell the user to connect it on the Integrations page.`,
      );
    }
    const integrationContext = integrationRules.join("\n");

    const system =
      options.mode === "chat"
        ? [
            CHAT_SYSTEM_PROMPT,
            "",
            "# Agent configuration",
            buildExecutionInstructions(options.agent),
            integrationContext ? `\n# Integration status\n${integrationContext}` : "",
            "",
            "Answer conversationally from the context above. Only call a tool when the user explicitly asks for fresh information or asks you to perform an action.",
          ]
            .filter(Boolean)
            .join("\n")
        : [
            RUNNER_SYSTEM_PROMPT,
            "",
            "# Agent configuration",
            buildExecutionInstructions(options.agent),
            integrationContext ? `\n# Integration status\n${integrationContext}` : "",
          ]
            .filter(Boolean)
            .join("\n");

    const messages: ChatMessage[] = [];
    for (const entry of options.history ?? []) {
      messages.push({ role: entry.role, content: entry.content });
    }
    messages.push({
      role: "user",
      content: `Execute the agent's objective now.\n\nTask input: ${
        options.input.trim() || options.agent.objective || "Complete the configured task"
      }\n\nToday is ${new Date().toUTCString()}. Use the available tools to complete the work, then produce the final deliverable.`,
    });

    const maxSteps = options.maxSteps ?? 8;
    let finalOutput = "";
    const executed: string[] = [];
    const deadline = Date.now() + Number(process.env.RUN_TIMEOUT_MS ?? 600_000);
    const toolTimeoutMs = Number(process.env.TOOL_TIMEOUT_MS ?? 240_000);

    for (let step = 0; step < maxSteps; step += 1) {
      if (options.shouldCancel?.()) {
        throw new RunCancelledError();
      }
      if (Date.now() > deadline) {
        throw new Error("Run exceeded the maximum duration");
      }

      const isFinalStep = step === maxSteps - 1;
      const stepInstruction = isFinalStep
        ? "\n\n# Final step\nDo NOT call any more tools. Write the complete final deliverable now, using only the information already gathered."
        : `\n\n# Progress\nStep ${step + 1} of ${maxSteps}. Prefer convergence: avoid repeating similar tool calls, and when you have enough data, write the deliverable instead of researching further.`;

      const result = await llm.chatWithTools({
        system: `${system}${stepInstruction}`,
        messages,
        tools: specs,
        temperature: 0.3,
        mockContext: {
          kind: options.mode === "chat" ? "chat" : "execute",
          agent: options.agent as unknown as Record<string, unknown>,
          input: options.input,
          executedTools: executed,
          runs: options.runs,
          userMessage: options.mode === "chat" ? options.input : undefined,
        },
      });

      if (result.type === "text") {
        const recovered = recoverFinalText(result.text);
        if (recovered) {
          finalOutput = recovered;
        } else {
          await emit({
            type: "info",
            title: "Malformed final answer ignored",
            detail:
              "The model returned tool-call markup instead of prose; synthesizing the deliverable from collected tool results.",
          });
        }
        break;
      }

      if (isFinalStep) break;

      for (const call of result.calls) {
        executed.push(call.name);
        const toolStarted = Date.now();

        // Cost/speed guard: live browser sessions are expensive, so cap how many
        // a single run may open. The model is told to work with what it has.
        const browserCalls = executed.filter((name) =>
          name.toUpperCase().startsWith("BROWSER_"),
        ).length;
        const browserCap = Number(process.env.BROWSER_MAX_CALLS_PER_RUN ?? 4);
        if (
          call.name.toUpperCase().startsWith("BROWSER_") &&
          browserCalls > browserCap
        ) {
          await emit({
            type: "info",
            title: "Browser call limit reached",
            detail: `Skipped ${call.name} (limit ${browserCap} per run). Continuing with existing data.`,
          });
          messages.push({
            role: "assistant",
            content: "",
            toolCalls: [call],
            // Thinking mode requires the reasoning echo on every assistant
            // turn that had tool calls, even when the call is skipped.
            reasoningContent: result.reasoningContent,
          });
          messages.push({
            role: "tool",
            name: call.name,
            toolCallId: call.id,
            content: JSON.stringify({
              status: "skipped",
              reason: `Browser session limit (${browserCap}) reached for this run. Use the data you already collected and produce the final deliverable now.`,
            }),
          });
          continue;
        }

        await emit({
          type: "tool_call",
          title: `Using ${call.name}`,
          toolSlug: call.name,
          input: call.arguments,
          detail: "Requested by the planner",
        });

        const execution = await withTimeout(
          toolset.execute(call.name, call.arguments),
          toolTimeoutMs,
          `Tool ${call.name} timed out after ${Math.round(toolTimeoutMs / 1000)}s`,
        );
        creditsUsed += 1;
        if (execution.browser?.liveUrl) liveUrl = execution.browser.liveUrl;
        if (execution.url && !liveUrl) liveUrl = execution.url;

        await emit({
          type: "tool_result",
          title: execution.title,
          toolSlug: call.name,
          detail: execution.summary,
          output: execution.output,
          durationMs: Date.now() - toolStarted,
        });

        messages.push({
          role: "assistant",
          content: result.content ?? "",
          toolCalls: [call],
          reasoningContent: result.reasoningContent,
        });
        messages.push({
          role: "tool",
          name: call.name,
          toolCallId: call.id,
          content: JSON.stringify(execution.output).slice(0, 3000),
        });
      }
    }

    if (!finalOutput) {
      // The planner stopped without prose: force a final synthesis from the
      // gathered tool results so the run always ships a usable deliverable.
      const toolMessages = messages.filter((message) => message.role === "tool");
      if (toolMessages.length > 0) {
        try {
          const transcript = toolMessages
            .slice(-8)
            .map(
              (message) =>
                `${message.name ?? "tool"}: ${message.content.slice(0, 700)}`,
            )
            .join("\n\n");
          finalOutput = await llm.generateText({
            system: [
              RUNNER_SYSTEM_PROMPT,
              buildExecutionInstructions(options.agent),
            ].join("\n"),
            prompt: `The research phase is complete. Write the final deliverable now in the required output format. Do not invent data — base everything on these collected tool results:\n\n${transcript}`,
            mockContext: {
              kind: "summary",
              agent: options.agent as unknown as Record<string, unknown>,
              input: options.input,
            },
          });
        } catch (error) {
          console.warn("[runner] final synthesis failed:", error);
        }
      }
    }

    if (!finalOutput) {
      // Last resort: summarize the recorded steps.
      const results = steps.filter((entry) => entry.type === "tool_result");
      finalOutput = [
        `# ${options.agent.name ?? "Agent"} — run report`,
        "",
        "The agent finished its tool work. Summary of outputs:",
        "",
        ...results.map((entry) => `- **${entry.title}** — ${entry.detail ?? ""}`),
        "",
        "> Reached the configured step limit before writing a full narrative.",
      ].join("\n");
    }

    // Keep the timeline row readable: a one-line plain-text summary, never a
    // raw markdown blob. The full deliverable lives in the output.
    const finalSummary =
      finalOutput
        .replace(/[#>*_`|]|\!\[/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 130) || "Final deliverable ready.";

    await emit({
      type: "final",
      title: "Deliverable ready",
      detail: finalSummary,
      output: { markdown: finalOutput },
    });

    return {
      status: "completed",
      output: finalOutput,
      steps,
      creditsUsed,
      liveUrl,
    };
  } catch (error) {
    if (error instanceof RunCancelledError) {
      await emit({
        type: "info",
        title: "Run stopped",
        detail: "Cancelled by the user — no further steps were executed.",
      });
      return {
        status: "cancelled",
        output: "",
        steps,
        error: "Cancelled by user",
        creditsUsed,
        liveUrl,
      };
    }
    const message = error instanceof Error ? error.message : "Unknown execution error";
    await emit({ type: "error", title: "Run failed", detail: message });
    return {
      status: "failed",
      output: "",
      steps,
      error: message,
      creditsUsed,
      liveUrl,
    };
  }
}
