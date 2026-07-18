ALTER TYPE "public"."shift_status" ADD VALUE 'checked_out' BEFORE 'completed';--> statement-breakpoint
ALTER TABLE "shifts" RENAME COLUMN "company_seen_check_in_at" TO "check_in_confirmed_at";--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "check_out_confirmed_at" timestamp with time zone;