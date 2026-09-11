import { z } from "zod";

export const clarificationQuestionSchema = z.object({
  id: z.string().describe("snake_case identifier, e.g. calendar_service"),
  question: z.string().describe("Short, specific question for the user"),
  type: z
    .enum(["text", "select", "multi_select"])
    .describe("Input style: free text, single choice, or multiple choice"),
  options: z
    .array(z.string())
    .optional()
    .describe("Concrete options for select/multi_select questions"),
  allowCustom: z
    .boolean()
    .optional()
    .describe("Allow the user to type an answer outside the options"),
  customPlaceholder: z
    .string()
    .optional()
    .describe("Placeholder shown for a custom answer"),
});

export const generatedScheduleSchema = z.object({
  type: z
    .enum(["manual", "once", "recurring"])
    .describe("manual = on demand only, once = a single date, recurring = repeats"),
  time: z.string().describe("Local time in 24h HH:mm format"),
  frequency: z
    .enum(["hourly", "daily", "weekly", "monthly"])
    .nullable()
    .optional()
    .describe("Required only for recurring schedules"),
  dayOfWeek: z
    .number()
    .nullable()
    .optional()
    .describe("0=Sunday .. 6=Saturday, required for weekly recurring"),
  dayOfMonth: z
    .number()
    .nullable()
    .optional()
    .describe("1-31, required for monthly recurring"),
  date: z
    .string()
    .nullable()
    .optional()
    .describe("YYYY-MM-DD, required for once"),
});

export const generatedAgentConfigSchema = z.object({
  name: z.string().describe("2-4 word memorable agent name"),
  description: z.string().describe("One sentence, max 160 characters"),
  objective: z.string().describe("Measurable outcome for every run"),
  instructions: z
    .string()
    .describe("Numbered, detailed operating instructions for the agent"),
  tools: z
    .array(z.string())
    .describe("Subset of the available tool slugs the agent may use"),
  skills: z.array(z.string()).describe("2-5 short capability labels"),
  schedule: generatedScheduleSchema,
  outputFormat: z.string().describe("How the final deliverable is formatted"),
});

export const agentConfigResponseSchema = z.object({
  status: z
    .enum(["needs_clarification", "ready"])
    .describe("Whether questions are required or the config is complete"),
  clarificationQuestions: z
    .array(clarificationQuestionSchema)
    .optional()
    .describe("Present only when status is needs_clarification"),
  config: generatedAgentConfigSchema
    .nullable()
    .optional()
    .describe("Present only when status is ready"),
});

export type ClarificationQuestion = z.infer<typeof clarificationQuestionSchema>;
export type GeneratedAgentConfig = z.infer<typeof generatedAgentConfigSchema>;
export type AgentConfigAiResponse = z.infer<typeof agentConfigResponseSchema>;

export const runResultSchema = z.object({
  summary: z.string().describe("Short overview of the run"),
  findings: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string(),
        link: z.string().nullable().optional(),
      }),
    )
    .describe("Key findings or outputs"),
  actions: z
    .array(z.string())
    .describe("Concrete actions taken through tools"),
  notes: z.string().nullable().optional().describe("Failures or attention items"),
});

export type RunResult = z.infer<typeof runResultSchema>;
