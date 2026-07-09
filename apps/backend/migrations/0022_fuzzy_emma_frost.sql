ALTER TABLE "worker_profiles" ADD COLUMN "bio" varchar(500);--> statement-breakpoint
ALTER TABLE "worker_profiles" ADD COLUMN "cpf" varchar(11);--> statement-breakpoint
CREATE UNIQUE INDEX "worker_profiles_cpf_unique" ON "worker_profiles" USING btree ("cpf");