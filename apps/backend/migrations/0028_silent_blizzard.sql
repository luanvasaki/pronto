ALTER TABLE "worker_profiles" ADD COLUMN "avg_category_scores" jsonb;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "avg_category_scores" jsonb;--> statement-breakpoint
ALTER TABLE "ratings" ADD COLUMN "category_scores" jsonb;