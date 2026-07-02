CREATE TYPE "public"."company_verification_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"legal_name" varchar(255) NOT NULL,
	"trade_name" varchar(255) NOT NULL,
	"cnpj" varchar(14) NOT NULL,
	"verification_status" "company_verification_status" DEFAULT 'pending' NOT NULL,
	"avg_rating" numeric(2, 1),
	"total_jobs_posted" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "companies_owner_user_id_unique" ON "companies" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_cnpj_unique" ON "companies" USING btree ("cnpj");