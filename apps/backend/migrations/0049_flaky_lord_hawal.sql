ALTER TABLE "worker_profiles" DROP COLUMN "total_shifts_completed";--> statement-breakpoint
ALTER TABLE "worker_profiles" DROP COLUMN "total_no_shows";--> statement-breakpoint
ALTER TABLE "companies" DROP COLUMN "total_jobs_posted";--> statement-breakpoint
ALTER TABLE "shifts" DROP COLUMN "check_in_lat";--> statement-breakpoint
ALTER TABLE "shifts" DROP COLUMN "check_in_lng";--> statement-breakpoint
ALTER TABLE "shifts" DROP COLUMN "check_out_lat";--> statement-breakpoint
ALTER TABLE "shifts" DROP COLUMN "check_out_lng";