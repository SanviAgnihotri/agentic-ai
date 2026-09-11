import {
  AGENT_CONFIG_SYSTEM_PROMPT,
  CHAT_SYSTEM_PROMPT,
  CLARIFICATION_ANSWER_HEADER,
} from "@/agent/config/prompts";
import {
  agentConfigResponseSchema,
  type AgentConfigAiResponse,
} from "@/agent/config/response-schema";
import { defaultToolSlugs } from "@/agent/tools/catalog";
import { getLlm } from "./llm";

export { getLlm, llmStatus } from "./llm";

export interface AgentRowForAi {
  name?: string | null;
  description?: string | null;
  objective?: string | null;
  instructions?: string | null;
  skills?: string[] | null;
  outputFormat?: string | null;
  tools?: string[] | null;
  schedule?: unknown;
  status?: string | null;
}

export async function generateAgentConfig(options: {
  prompt: string;
  answers?: Record<string, string> | null;
  toolSlugs?: string[];
  connectedTools?: Array<{ slug: string; name: string }>;
  timeZone?: string;
}): Promise<AgentConfigAiResponse> {
  const llm = getLlm();
  const toolSlugs = options.toolSlugs?.length ? options.toolSlugs : defaultToolSlugs;
  const connected = options.connectedTools ?? [];

  const composedPrompt = options.answers
    ? `${options.prompt}\n\n${CLARIFICATION_ANSWER_HEADER}\n${JSON.stringify(options.answers)}`
    : options.prompt;

  const system = AGENT_CONFIG_SYSTEM_PROMPT.replace(
    "[AVAILABLE_TOOLS]",
    toolSlugs.join(", "),
  )
    .replace(
      "[CONNECTED_TOOLS]",
      connected.length > 0
        ? connected.map((tool) => `${tool.slug} (${tool.name})`).join(", ")
        : "None connected yet.",
    )
    .replace("[USER_PROMPT]", composedPrompt);

  return llm.generateObject<AgentConfigAiResponse>({
    system,
    prompt: composedPrompt,
    schema: agentConfigResponseSchema,
    schemaName: "agent_config_response",
    temperature: 0.4,
    mockContext: {
      kind: "agent-config",
      prompt: composedPrompt,
      toolSlugs,
      connectedToolSlugs: connected.map((tool) => tool.slug),
    },
  });
}

export async function generateAgentChat(options: {
  agent: AgentRowForAi;
  runs: Array<{ createdAt: Date | string; output: string | null; status: string }>;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
  pending?: string[];
}): Promise<string> {
  const llm = getLlm();
  const agentContext = [
    `Agent name: ${options.agent.name ?? "Agent"}`,
    `Description: ${options.agent.description ?? ""}`,
    `Objective: ${options.agent.objective ?? ""}`,
    `Instructions: ${options.agent.instructions ?? ""}`,
    `Skills: ${(options.agent.skills ?? []).join(", ")}`,
    `Tools: ${(options.agent.tools ?? []).join(", ")}`,
    `Status: ${options.agent.status ?? "active"}`,
    `Schedule: ${JSON.stringify(options.agent.schedule ?? { type: "manual" })}`,
    options.pending?.length
      ? `Currently working on: ${options.pending.join("; ")}`
      : "",
    "",
    "Recent runs (newest first):",
    ...options.runs.slice(0, 3).map(
      (run) =>
        `- [${new Date(run.createdAt).toISOString()}] (${run.status}) ${(run.output ?? "")
          .slice(0, 1200)
          .replace(/\n+/g, " ")}`,
    ),
  ]
    .filter(Boolean)
    .join("\n");

  const history = options.history
    .slice(-10)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  return llm.generateText({
    system: `${CHAT_SYSTEM_PROMPT}\n\n# Agent context\n${agentContext}`,
    prompt: `${history ? `# Conversation so far\n${history}\n\n` : ""}User: ${options.userMessage}`,
    temperature: 0.5,
    mockContext: {
      kind: "chat",
      agent: options.agent as Record<string, unknown>,
      runs: options.runs as unknown as Array<Record<string, unknown>>,
      userMessage: options.userMessage,
    },
  });
}
