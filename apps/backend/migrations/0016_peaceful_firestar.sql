ALTER TYPE "public"."payment_status" ADD VALUE 'confirmed' BEFORE 'failed';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'disputed' BEFORE 'failed';--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "disputed_at" timestamp with time zone;