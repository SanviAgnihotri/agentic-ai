import type OpenAI from "openai";
import {
  parametersToJsonSchema,
  toGeminiCompatibleSchema,
  toStrictJsonSchema,
  zodToJsonSchema,
} from "./schema-utils";
import {
  mockAgentConfig,
  mockBriefing,
  mockChatAnswer,
  mockToolDecision,
} from "./mock";
import type {
  ChatMessage,
  ChatWithToolsOptions,
  GenerateObjectOptions,
  GenerateTextOptions,
  LlmChatResult,
  LlmProvider,
  MockContext,
} from "./types";

/* ------------------------------------------------------------------ */
/* Provider selection                                                  */
/* ------------------------------------------------------------------ */

export function getLlm(): LlmProvider {
  const explicit = (process.env.LLM_PROVIDER ?? "").toLowerCase();
  if (explicit === "mock") return mockProvider;
  if (explicit === "opencode-go" || explicit === "opencode")
    return opencodeGoProvider();
  if (explicit === "groq") return groqProvider();
  if (explicit === "openai") return openAiProvider();
  if (explicit === "gemini") return geminiProvider();
  if (process.env.OPENCODE_GO_API_KEY) return opencodeGoProvider();
  if (process.env.GROQ_API_KEY) return groqProvider();
  if (process.env.OPENAI_API_KEY) return openAiProvider();
  if (process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY)
    return geminiProvider();
  return mockProvider;
}

export function llmStatus(): { provider: string; model: string; live: boolean } {
  const llm = getLlm();
  return { provider: llm.id, model: llm.model, live: llm.id !== "mock" };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function isRetryableProviderError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /429|rate limit|too many requests|503|502|overloaded|temporarily unavailable/i.test(
    message,
  );
}

/** Retries provider rate-limit/5xx failures with exponential backoff. */
async function withRateLimitRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  const delays = [5_000, 15_000, 30_000];
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryableProviderError(error) || attempt === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delays[attempt] ?? 30_000));
    }
  }
  throw lastError;
}

/** Wraps an OpenAI-compatible client so every completion retries on 429/5xx. */
function retryingClient<T extends import("openai").default>(client: T): T {
  const original = client.chat.completions.create.bind(client.chat.completions);
  client.chat.completions.create = ((params: unknown, options?: unknown) =>
    withRateLimitRetry(() =>
      original(params as never, options as never),
    )) as typeof client.chat.completions.create;
  return client;
}

/* ------------------------------------------------------------------ */
/* Groq (OpenAI-compatible) — primary recommended provider              */
/* ------------------------------------------------------------------ */

function groqProvider(): LlmProvider {
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  let client: import("openai").default | null = null;

  const getClient = async () => {
    if (!client) {
      const { default: OpenAI } = await import("openai");
      client = retryingClient(
        new OpenAI({
          apiKey: process.env.GROQ_API_KEY,
          baseURL: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
        }),
      );
    }
    return client;
  };

  return {
    id: "groq",
    label: "Groq",
    model,
    async generateObject<T>(options: GenerateObjectOptions<T>): Promise<T> {
      const openai = await getClient();
      const schema = toStrictJsonSchema(zodToJsonSchema(options.schema));
      const completion = await openai.chat.completions.create({
        model,
        temperature: options.temperature ?? 0.4,
        messages: [
          { role: "system", content: options.system },
          {
            role: "user",
            content: `${options.prompt}\n\nRespond with a single JSON object that matches this JSON Schema exactly:\n${JSON.stringify(
              schema,
            )}`,
          },
        ],
        response_format: { type: "json_object" },
      });
      const content = completion.choices[0]?.message?.content ?? "{}";
      return options.schema.parse(extractJson(content));
    },
    async generateText(options: GenerateTextOptions): Promise<string> {
      const openai = await getClient();
      const completion = await openai.chat.completions.create({
        model,
        temperature: options.temperature ?? 0.6,
        messages: [
          ...(options.system ? [{ role: "system" as const, content: options.system }] : []),
          { role: "user", content: options.prompt },
        ],
      });
      return completion.choices[0]?.message?.content ?? "";
    },
    async chatWithTools(options: ChatWithToolsOptions): Promise<LlmChatResult> {
      const openai = await getClient();
      const completion = await openai.chat.completions.create({
        model,
        temperature: options.temperature ?? 0.3,
        messages: [
          { role: "system", content: options.system },
          ...options.messages.map(toOpenAiMessage),
        ],
        tools: options.tools.map((tool) => ({
          type: "function" as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: toStrictJsonSchema(parametersToJsonSchema(tool.parameters)),
          },
        })),
      });
      const message = completion.choices[0]?.message;
      if (message?.tool_calls?.length) {
        return {
          type: "tool_calls",
          calls: message.tool_calls
            .filter((call) => call.type === "function")
            .map((call) => ({
              id: call.id,
              name: call.function.name,
              arguments: safeParse(call.function.arguments),
            })),
        };
      }
      return { type: "text", text: message?.content ?? "" };
    },
  };
}

/* ------------------------------------------------------------------ */
/* OpenCode Go (zen/go) — OpenAI-compatible, DeepSeek V4                */
/* ------------------------------------------------------------------ */

function opencodeGoProvider(): LlmProvider {
  const model = process.env.OPENCODE_GO_MODEL || "deepseek-flash";
  let client: import("openai").default | null = null;

  // Go requires a stable session id + identifying user agent for routing and
  // prompt caching (https://opencode.ai/docs/go/#where-can-i-use-it).
  const sessionId =
    process.env.OPENCODE_GO_SESSION_ID ||
    `groovy-ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  const getClient = async () => {
    if (!client) {
      const { default: OpenAI } = await import("openai");
      client = retryingClient(
        new OpenAI({
          apiKey: process.env.OPENCODE_GO_API_KEY,
          baseURL: process.env.OPENCODE_GO_BASE_URL || "https://opencode.ai/zen/go/v1",
          defaultHeaders: {
            "x-opencode-session": sessionId,
            "User-Agent": "groovy-ai/1.0",
          },
        }),
      );
    }
    return client;
  };

  return {
    id: "opencode-go",
    label: "OpenCode Go",
    model,
    async generateObject<T>(options: GenerateObjectOptions<T>): Promise<T> {
      const openai = await getClient();
      const schema = toStrictJsonSchema(zodToJsonSchema(options.schema));
      const completion = await openai.chat.completions.create({
        model,
        temperature: options.temperature ?? 0.4,
        messages: [
          { role: "system", content: options.system },
          {
            role: "user",
            content: `${options.prompt}\n\nRespond with a single JSON object that matches this JSON Schema exactly:\n${JSON.stringify(schema)}`,
          },
        ],
        response_format: { type: "json_object" },
      });
      const content = completion.choices[0]?.message?.content ?? "{}";
      return options.schema.parse(extractJson(content));
    },
    async generateText(options: GenerateTextOptions): Promise<string> {
      const openai = await getClient();
      const completion = await openai.chat.completions.create({
        model,
        temperature: options.temperature ?? 0.6,
        messages: [
          ...(options.system
            ? [{ role: "system" as const, content: options.system }]
            : []),
          { role: "user", content: options.prompt },
        ],
      });
      return completion.choices[0]?.message?.content ?? "";
    },
    async chatWithTools(options: ChatWithToolsOptions): Promise<LlmChatResult> {
      const openai = await getClient();
      const completion = await openai.chat.completions.create({
        model,
        temperature: options.temperature ?? 0.3,
        messages: [
          { role: "system", content: options.system },
          ...options.messages.map(toOpenAiMessage),
        ],
        tools: options.tools.map((tool) => ({
          type: "function" as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: toStrictJsonSchema(parametersToJsonSchema(tool.parameters)),
          },
        })),
      });
      const message = completion.choices[0]?.message as
        | (OpenAI.Chat.Completions.ChatCompletionMessage & {
            reasoning_content?: string;
          })
        | undefined;
      if (message?.tool_calls?.length) {
        return {
          type: "tool_calls",
          calls: message.tool_calls
            .filter((call) => call.type === "function")
            .map((call) => ({
              id: call.id,
              name: call.function.name,
              arguments: safeParse(call.function.arguments),
            })),
          reasoningContent: message.reasoning_content,
          content: message.content ?? "",
        };
      }
      return {
        type: "text",
        text: message?.content ?? "",
        reasoningContent: message?.reasoning_content,
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/* OpenAI                                                               */
/* ------------------------------------------------------------------ */

function openAiProvider(): LlmProvider {
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  let client: import("openai").default | null = null;

  const getClient = async () => {
    if (!client) {
      const { default: OpenAI } = await import("openai");
      client = retryingClient(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
    }
    return client;
  };

  return {
    id: "openai",
    label: "OpenAI",
    model,
    async generateObject<T>(options: GenerateObjectOptions<T>): Promise<T> {
      const openai = await getClient();
      const schema = toStrictJsonSchema(zodToJsonSchema(options.schema));
      const completion = await openai.chat.completions.create({
        model,
        temperature: options.temperature ?? 0.4,
        messages: [
          { role: "system", content: options.system },
          { role: "user", content: options.prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: options.schemaName ?? "response",
            strict: true,
            schema,
          },
        },
      });
      const content = completion.choices[0]?.message?.content ?? "{}";
      return options.schema.parse(JSON.parse(content));
    },
    async generateText(options: GenerateTextOptions): Promise<string> {
      const openai = await getClient();
      const completion = await openai.chat.completions.create({
        model,
        temperature: options.temperature ?? 0.6,
        messages: [
          ...(options.system ? [{ role: "system" as const, content: options.system }] : []),
          { role: "user", content: options.prompt },
        ],
      });
      return completion.choices[0]?.message?.content ?? "";
    },
    async chatWithTools(options: ChatWithToolsOptions): Promise<LlmChatResult> {
      const openai = await getClient();
      const completion = await openai.chat.completions.create({
        model,
        temperature: options.temperature ?? 0.3,
        messages: [
          { role: "system", content: options.system },
          ...options.messages.map(toOpenAiMessage),
        ],
        tools: options.tools.map((tool) => ({
          type: "function" as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: toStrictJsonSchema(parametersToJsonSchema(tool.parameters)),
          },
        })),
      });
      const message = completion.choices[0]?.message;
      if (message?.tool_calls?.length) {
        return {
          type: "tool_calls",
          calls: message.tool_calls
            .filter((call) => call.type === "function")
            .map((call) => ({
              id: call.id,
              name: call.function.name,
              arguments: safeParse(call.function.arguments),
            })),
        };
      }
      return { type: "text", text: message?.content ?? "" };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Google Gemini                                                        */
/* ------------------------------------------------------------------ */

function geminiProvider(): LlmProvider {
  const apiKey =
    process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  let client: import("@google/genai").GoogleGenAI | null = null;

  const getClient = async () => {
    if (!client) {
      const { GoogleGenAI } = await import("@google/genai");
      client = new GoogleGenAI({ apiKey });
    }
    return client;
  };

  return {
    id: "gemini",
    label: "Gemini",
    model,
    async generateObject<T>(options: GenerateObjectOptions<T>): Promise<T> {
      const ai = await getClient();
      const response = await ai.models.generateContent({
        model,
        contents: options.prompt,
        config: {
          systemInstruction: options.system,
          responseMimeType: "application/json",
          responseSchema: toGeminiCompatibleSchema(zodToJsonSchema(options.schema)),
          temperature: options.temperature ?? 0.4,
        },
      });
      const text = response.text ?? "{}";
      return options.schema.parse(JSON.parse(text));
    },
    async generateText(options: GenerateTextOptions): Promise<string> {
      const ai = await getClient();
      const response = await ai.models.generateContent({
        model,
        contents: options.prompt,
        config: {
          ...(options.system ? { systemInstruction: options.system } : {}),
          temperature: options.temperature ?? 0.6,
        },
      });
      return response.text ?? "";
    },
    async chatWithTools(options: ChatWithToolsOptions): Promise<LlmChatResult> {
      const ai = await getClient();
      const contents = options.messages.map(toGeminiContent);
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: options.system,
          temperature: options.temperature ?? 0.3,
          tools: [
            {
              functionDeclarations: options.tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                parametersJsonSchema: toGeminiCompatibleSchema(
                  parametersToJsonSchema(tool.parameters),
                ),
              })),
            },
          ],
        },
      });
      const calls = response.functionCalls;
      if (calls?.length) {
        return {
          type: "tool_calls",
          calls: calls.map((call, index) => ({
            id: `${call.name ?? "call"}-${index}-${Date.now()}`,
            name: call.name ?? "",
            arguments: (call.args ?? {}) as Record<string, unknown>,
          })),
        };
      }
      return { type: "text", text: response.text ?? "" };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Offline mock                                                         */
/* ------------------------------------------------------------------ */

export const mockProvider: LlmProvider = {
  id: "mock",
  label: "Groovy Simulation",
  model: "built-in",
  async generateObject<T>(options: GenerateObjectOptions<T>): Promise<T> {
    const context = options.mockContext;
    if (context?.kind === "agent-config") {
      const result = mockAgentConfig({
        prompt: context.prompt ?? options.prompt,
        toolSlugs: context.toolSlugs ?? [],
        connectedToolSlugs: (context.connectedToolSlugs as string[] | undefined) ?? [],
      });
      return options.schema.parse(result);
    }
    if (context?.kind === "briefing") {
      return options.schema.parse(mockBriefing(context));
    }
    // Generic structured fallback: expose the mock context as JSON if it fits.
    const fallback = {
      summary: "Demo run completed successfully.",
      findings: [],
      actions: [],
      notes: null,
    };
    return options.schema.parse(fallback);
  },
  async generateText(options: GenerateTextOptions): Promise<string> {
    const context = options.mockContext;
    if (context?.kind === "chat") return mockChatAnswer(context);
    if (context?.kind === "briefing") return mockBriefing(context);
    return mockChatAnswer(context ?? { kind: "chat" });
  },
  async chatWithTools(options: ChatWithToolsOptions): Promise<LlmChatResult> {
    return mockToolDecision(options.mockContext ?? { kind: "execute" }, options.messages);
  },
};

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function toOpenAiMessage(message: ChatMessage) {
  if (message.role === "tool") {
    return {
      role: "tool" as const,
      tool_call_id: message.toolCallId ?? message.name ?? "tool",
      content: message.content,
    };
  }
  if (message.role === "assistant" && message.toolCalls?.length) {
    return {
      role: "assistant" as const,
      content: message.content || null,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: "function" as const,
        function: {
          name: call.name,
          arguments: JSON.stringify(call.arguments),
        },
      })),
      // DeepSeek thinking mode requires reasoning_content echoed back.
      ...(message.reasoningContent
        ? { reasoning_content: message.reasoningContent }
        : {}),
    } as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam;
  }
  return {
    role: message.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: message.content,
  };
}

function toGeminiContent(message: ChatMessage) {
  if (message.role === "tool") {
    return {
      role: "user",
      parts: [
        {
          functionResponse: {
            name: message.name ?? "tool",
            response: { output: message.content },
          },
        },
      ],
    };
  }
  if (message.role === "assistant" && message.toolCalls?.length) {
    return {
      role: "model",
      parts: message.toolCalls.map((call) => ({
        functionCall: { name: call.name, args: call.arguments },
      })),
    };
  }
  return {
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  };
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error("Model did not return JSON");
}

function safeParse(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

export type { MockContext };
