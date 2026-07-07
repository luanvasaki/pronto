ALTER TABLE "users" ADD COLUMN "google_photo_url" varchar(500);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "worker_profiles" ADD COLUMN "photo_url" varchar(500);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "logo_url" varchar(500);