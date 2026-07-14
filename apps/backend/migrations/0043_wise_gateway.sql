ALTER TABLE "applications" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "terms_version" varchar(20);