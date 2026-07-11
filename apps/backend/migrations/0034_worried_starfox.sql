CREATE TYPE "public"."company_person_type" AS ENUM('juridica', 'fisica');--> statement-breakpoint
CREATE TABLE "company_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"file_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "cnpj" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "person_type" "company_person_type" DEFAULT 'juridica' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "cpf" varchar(11);--> statement-breakpoint
ALTER TABLE "company_documents" ADD CONSTRAINT "company_documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "companies_cpf_unique" ON "companies" USING btree ("cpf");