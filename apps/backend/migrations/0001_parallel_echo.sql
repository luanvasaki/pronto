CREATE TYPE "public"."kyc_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "worker_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"home_lat" double precision,
	"home_lng" double precision,
	"search_radius_km" integer DEFAULT 10 NOT NULL,
	"kyc_status" "kyc_status" DEFAULT 'pending' NOT NULL,
	"avg_rating" numeric(2, 1),
	"total_shifts_completed" integer DEFAULT 0 NOT NULL,
	"total_no_shows" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "worker_profiles" ADD CONSTRAINT "worker_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;