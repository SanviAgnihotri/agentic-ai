CREATE TABLE "agent_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_email" text,
	"agent_id" text NOT NULL,
	"name" varchar(255),
	"agent_image" varchar(512),
	"description" text,
	"instructions" text,
	"objective" text,
	"tools" jsonb DEFAULT '[]'::jsonb,
	"skills" jsonb DEFAULT '[]'::jsonb,
	"schedule" jsonb,
	"output_format" text,
	"max_steps" integer DEFAULT 8,
	"status" varchar(32) DEFAULT 'active',
	"composio_session_id" varchar(255) DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_config_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint
CREATE TABLE "agent_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"user_email" text,
	"run_id" integer,
	"role" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_run" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"user_email" text,
	"schedule_for" timestamp NOT NULL,
	"time_zone" varchar(64),
	"status" varchar(32) DEFAULT 'scheduled' NOT NULL,
	"trigger" varchar(32) DEFAULT 'schedule',
	"output" text,
	"steps" jsonb DEFAULT '[]'::jsonb,
	"error" text,
	"queued_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(128) NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "tool_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL,
	"slug" varchar(120) NOT NULL,
	"account_label" varchar(255),
	"status" varchar(32) DEFAULT 'connected' NOT NULL,
	"external_id" varchar(255),
	"metadata" jsonb,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tools" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"icon" varchar(128),
	"category" varchar(120),
	"color" varchar(32),
	"requires_auth" boolean DEFAULT true,
	"provider" varchar(32) DEFAULT 'composio',
	"toolkit" varchar(120),
	"actions" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tools_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(512),
	"image_url" varchar(512),
	"timezone" varchar(64) DEFAULT 'UTC',
	"plan" varchar(32) DEFAULT 'free',
	"agent_credits" integer DEFAULT 3,
	"usage_credits" integer DEFAULT 200,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "agent_config" ADD CONSTRAINT "agent_config_user_email_users_email_fk" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_agent_id_agent_config_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_config"("agent_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_agent_id_agent_config_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_config"("agent_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_config_user_email_idx" ON "agent_config" USING btree ("user_email");--> statement-breakpoint
CREATE INDEX "agent_messages_agent_id_idx" ON "agent_messages" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_run_schedule_for_idx" ON "agent_run" USING btree ("schedule_for");--> statement-breakpoint
CREATE INDEX "agent_run_agent_id_idx" ON "agent_run" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_run_status_idx" ON "agent_run" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tool_connections_user_idx" ON "tool_connections" USING btree ("user_email","slug");