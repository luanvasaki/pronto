ALTER TABLE "applications" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "worker_seen_removal_at" timestamp with time zone;