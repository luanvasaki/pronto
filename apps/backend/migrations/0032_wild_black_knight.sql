CREATE TYPE "public"."document_type" AS ENUM('identity', 'selfie');--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "type" "document_type" DEFAULT 'identity' NOT NULL;