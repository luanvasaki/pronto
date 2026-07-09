CREATE TYPE "public"."skill_category_status" AS ENUM('approved', 'pending');--> statement-breakpoint
ALTER TABLE "skill_categories" ADD COLUMN "status" "skill_category_status" DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "skill_categories" ADD COLUMN "created_by_company_id" uuid;--> statement-breakpoint
ALTER TABLE "skill_categories" ADD CONSTRAINT "skill_categories_created_by_company_id_companies_id_fk" FOREIGN KEY ("created_by_company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;