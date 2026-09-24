CREATE TYPE "public"."referral_source" AS ENUM('instagram', 'referral', 'google_search', 'other');--> statement-breakpoint
ALTER TABLE "worker_profiles" ADD COLUMN "referral_source" "referral_source";--> statement-breakpoint
ALTER TABLE "worker_profiles" ADD COLUMN "referral_source_other" varchar(255);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "referral_source" "referral_source";--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "referral_source_other" varchar(255);