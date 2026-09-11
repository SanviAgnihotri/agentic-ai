import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Groovy AI — database schema.
 *
 * Mirrors the tutorial's four core tables (users, tools, agent_config, agent_run)
 * with the same jsonb-based agent configuration shape, plus three additive tables
 * needed for the full product shown in the demo:
 *  - sessions          → local auth sessions (tutorial uses Clerk; adapter-friendly)
 *  - agent_messages    → chat history (tutorial chat is stateless)
 *  - tool_connections  → demo-mode integration connections (Composio owns these in production)
 */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 512 }),
  imageUrl: text("image_url"),
  timezone: varchar("timezone", { length: 64 }).default("UTC"),
  plan: varchar("plan", { length: 32 }).default("free"),
  agentCredits: integer("agent_credits").default(3),
  usageCredits: integer("usage_credits").default(200),
  // Billing — Dodo Payments (Merchant of Record). The webhook handler keeps
  // `plan`/`subscriptionStatus` in sync with the customer's subscription.
  dodoCustomerId: varchar("dodo_customer_id", { length: 255 }).unique(),
  dodoSubscriptionId: varchar("dodo_subscription_id", { length: 255 }),
  subscriptionStatus: varchar("subscription_status", { length: 32 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tools = pgTable("tools", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 128 }),
  category: varchar("category", { length: 120 }),
  color: varchar("color", { length: 32 }),
  requiresAuth: boolean("requires_auth").default(true),
  provider: varchar("provider", { length: 32 }).default("composio"),
  toolkit: varchar("toolkit", { length: 120 }),
  actions: jsonb("actions").default([]),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ScheduleConfig = {
  type: "manual" | "once" | "recurring";
  time: string; // "HH:mm"
  frequency?: "hourly" | "daily" | "weekly" | "monthly" | null;
  dayOfWeek?: number | null; // 0-6 (0 = Sunday), for weekly
  dayOfMonth?: number | null; // 1-31, for monthly
  date?: string | null; // ISO date, for once
  timeZone?: string | null;
};

export const agentConfig = pgTable(
  "agent_config",
  {
    id: serial("id").primaryKey(),
    userEmail: text("user_email").references(() => users.email),
    agentId: text("agent_id").notNull().unique(),
    name: varchar("name", { length: 255 }),
    agentImage: text("agent_image"),
    description: text("description"),
    instructions: text("instructions"),
    objective: text("objective"),
    tools: jsonb("tools").$type<string[]>().default([]),
    skills: jsonb("skills").$type<string[]>().default([]),
    schedule: jsonb("schedule").$type<ScheduleConfig>(),
    outputFormat: text("output_format"),
    maxSteps: integer("max_steps").default(8),
    status: varchar("status", { length: 32 }).default("active"),
    composioSessionId: varchar("composio_session_id", { length: 255 }).default(""),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("agent_config_user_email_idx").on(t.userEmail)],
);

export type RunStep = {
  index: number;
  type: "thought" | "tool_call" | "tool_result" | "browser" | "final" | "error" | "info";
  title: string;
  detail?: string;
  toolSlug?: string;
  input?: unknown;
  output?: unknown;
  at: string;
  durationMs?: number;
};

export const agentRun = pgTable(
  "agent_run",
  {
    id: serial("id").primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agentConfig.agentId, { onDelete: "cascade" }),
    userEmail: text("user_email"),
    scheduleFor: timestamp("schedule_for").notNull(),
    timeZone: varchar("time_zone", { length: 64 }),
    status: varchar("status", { length: 32 }).default("scheduled").notNull(),
    trigger: varchar("trigger", { length: 32 }).default("schedule"),
    output: text("output"),
    steps: jsonb("steps").$type<RunStep[]>().default([]),
    error: text("error"),
    queuedAt: timestamp("queued_at"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("agent_run_schedule_for_idx").on(t.scheduleFor),
    index("agent_run_agent_id_idx").on(t.agentId),
    index("agent_run_status_idx").on(t.status),
    // Every user-scoped list/count query filters on this — full scans otherwise.
    index("agent_run_user_email_idx").on(t.userEmail, t.createdAt),
  ],
);

export const agentMessages = pgTable(
  "agent_messages",
  {
    id: serial("id").primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agentConfig.agentId, { onDelete: "cascade" }),
    userEmail: text("user_email"),
    runId: integer("run_id"),
    role: varchar("role", { length: 16 }).notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("agent_messages_agent_id_idx").on(t.agentId)],
);

export const toolConnections = pgTable(
  "tool_connections",
  {
    id: serial("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    accountLabel: varchar("account_label", { length: 255 }),
    status: varchar("status", { length: 32 }).default("connected").notNull(),
    externalId: varchar("external_id", { length: 255 }),
    metadata: jsonb("metadata"),
    connectedAt: timestamp("connected_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("tool_connections_user_idx").on(t.userEmail, t.slug)],
);
