import { z } from "zod";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Tool name for role === "tool" */
  name?: string;
  /** Tool call id for role === "tool" */
  toolCallId?: string;
  /** Tool calls made by the assistant (needed for OpenAI-compatible providers) */
  toolCalls?: LlmToolCall[];
  /** DeepSeek thinking-mode reasoning that must be echoed back with tool calls */
  reasoningContent?: string;
}

export interface LlmToolSpec {
  name: string;
  description: string;
  /** Zod schema or a raw JSON Schema object (e.g. from an MCP server). */
  parameters: z.ZodType | Record<string, unknown>;
}

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export type LlmChatResult =
  | { type: "text"; text: string; reasoningContent?: string }
  | {
      type: "tool_calls";
      calls: LlmToolCall[];
      reasoningContent?: string;
      content?: string;
    };

/**
 * Context handed to the offline mock provider (and ignored by real providers)
 * so the platform produces meaningful results without any API keys.
 */
export interface MockContext {
  kind: "agent-config" | "chat" | "execute" | "briefing" | "summary";
  prompt?: string;
  input?: string;
  toolSlugs?: string[];
  agent?: Record<string, unknown>;
  runs?: Array<Record<string, unknown>>;
  stats?: Record<string, unknown>;
  userMessage?: string;
  executedTools?: string[];
  [key: string]: unknown;
}

export interface GenerateObjectOptions<T> {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  schemaName?: string;
  temperature?: number;
  mockContext?: MockContext;
}

export interface GenerateTextOptions {
  system?: string;
  prompt: string;
  temperature?: number;
  mockContext?: MockContext;
}

export interface ChatWithToolsOptions {
  system: string;
  messages: ChatMessage[];
  tools: LlmToolSpec[];
  temperature?: number;
  mockContext?: MockContext;
}

export interface LlmProvider {
  id: "opencode-go" | "groq" | "openai" | "gemini" | "mock";
  label: string;
  model: string;
  generateObject<T>(options: GenerateObjectOptions<T>): Promise<T>;
  generateText(options: GenerateTextOptions): Promise<string>;
  chatWithTools(options: ChatWithToolsOptions): Promise<LlmChatResult>;
}
