CREATE TYPE "public"."consent_document_type" AS ENUM('platform_terms', 'minors_opportunity', 'login_summary');--> statement-breakpoint
CREATE TABLE "consent_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "consent_document_type" NOT NULL,
	"version" varchar(20) NOT NULL,
	"chapters" jsonb NOT NULL,
	"declaration" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"version" varchar(20) NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "terms_ip_address" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "terms_user_agent" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "terms_ip_address" varchar(64);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "terms_user_agent" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "minors_terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "minors_terms_version" varchar(20);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "minors_terms_ip_address" varchar(64);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "minors_terms_user_agent" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "terms_ip_address" varchar(64);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "terms_user_agent" text;--> statement-breakpoint
ALTER TABLE "login_consents" ADD CONSTRAINT "login_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "consent_documents_type_version_unique" ON "consent_documents" USING btree ("type","version");--> statement-breakpoint
CREATE UNIQUE INDEX "login_consents_user_id_version_unique" ON "login_consents" USING btree ("user_id","version");