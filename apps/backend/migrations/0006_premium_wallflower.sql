CREATE TYPE "public"."shift_status" AS ENUM('scheduled', 'checked_in', 'completed', 'no_show', 'cancelled');--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"status" "shift_status" DEFAULT 'scheduled' NOT NULL,
	"pay_amount_snapshot" numeric(10, 2) NOT NULL,
	"check_in_at" timestamp with time zone,
	"check_in_lat" double precision,
	"check_in_lng" double precision,
	"check_out_at" timestamp with time zone,
	"check_out_lat" double precision,
	"check_out_lng" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_worker_id_worker_profiles_user_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker_profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_application_id_unique" ON "shifts" USING btree ("application_id");