CREATE TYPE "public"."benefit_provision" AS ENUM('none', 'on_site', 'paid');--> statement-breakpoint
ALTER TYPE "public"."document_type" ADD VALUE 'guardian_identity';--> statement-breakpoint
ALTER TABLE "worker_profiles" ADD COLUMN "guardian_full_name" varchar(255);--> statement-breakpoint
ALTER TABLE "worker_profiles" ADD COLUMN "guardian_cpf" varchar(11);--> statement-breakpoint
ALTER TABLE "worker_profiles" ADD COLUMN "guardian_phone" varchar(20);--> statement-breakpoint
ALTER TABLE "worker_profiles" ADD COLUMN "guardian_authorized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "meal_provision" "benefit_provision" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "meal_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "transport_provision" "benefit_provision" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "transport_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "minors_allowed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Migra o dado das colunas antigas (booleano sim/não) pro novo formato
-- antes delas serem removidas numa migration seguinte — sem isso, toda
-- vaga que já oferecia alimentação/transporte perderia essa informação
-- silenciosamente ao virar 'none'. "No local" é o equivalente mais
-- próximo do antigo "sim" (não havia opção de valor em dinheiro antes).
UPDATE "jobs" SET "meal_provision" = 'on_site' WHERE "offers_meal" = true;--> statement-breakpoint
UPDATE "jobs" SET "transport_provision" = 'on_site' WHERE "offers_transport" = true;