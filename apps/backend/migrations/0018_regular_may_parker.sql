CREATE TYPE "public"."business_segment" AS ENUM('bar', 'restaurante', 'buffet', 'hotel', 'eventos', 'casa_noturna', 'outro');--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "address_label" varchar(255);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "business_segment" "business_segment";