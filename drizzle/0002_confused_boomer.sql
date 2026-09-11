ALTER TABLE "users" ADD COLUMN "dodo_customer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "dodo_subscription_id" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_status" varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_dodo_customer_id_unique" UNIQUE("dodo_customer_id");