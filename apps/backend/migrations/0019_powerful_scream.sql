ALTER TABLE "jobs" ADD COLUMN "requires_experience" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "dress_code" varchar(255);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "tools_required" varchar(255);