ALTER TABLE "companies" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "skill_categories" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "skill_categories" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_categories" ADD CONSTRAINT "skill_categories_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;