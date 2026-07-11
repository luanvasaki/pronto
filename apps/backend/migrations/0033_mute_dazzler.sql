CREATE TYPE "public"."cnh_category" AS ENUM('A', 'B', 'AB', 'C', 'D', 'E');--> statement-breakpoint
ALTER TABLE "worker_profiles" ADD COLUMN "cnh_category" "cnh_category";--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "cnh_category" "cnh_category";--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "cnh_required" boolean DEFAULT false NOT NULL;