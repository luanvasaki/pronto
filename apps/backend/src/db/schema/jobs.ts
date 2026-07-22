import {
  boolean,
  doublePrecision,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { cnhCategoryEnum } from './cnh';
import { companies } from './companies';
import { skillCategories } from './skill-categories';

export const jobStatusEnum = pgEnum('job_status', ['open', 'filled', 'cancelled']);
// 'none' = não oferece; 'on_site' = fornece no local, sem custo extra
// pro trabalhador (ex.: refeição servida, van da empresa); 'paid' =
// paga um valor em dinheiro (vale-refeição/transporte), guardado em
// `mealAmount`/`transportAmount`.
export const benefitProvisionEnum = pgEnum('benefit_provision', ['none', 'on_site', 'paid']);

/**
 * Sem `onDelete: cascade` em company_id/category_id de propósito —
 * vaga é registro de negócio, não extensão de identidade. Apagar a
 * empresa não deveria apagar o histórico de vagas dela silenciosamente.
 */
export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => skillCategories.id),
  description: text('description').notNull(),
  // Perguntas padronizadas — respondidas antes da descrição livre no
  // formulário, mas guardadas soltas (não dentro do texto) pra dar pra
  // mostrar como badge/linha separada no card do trabalhador.
  requiresExperience: boolean('requires_experience').notNull().default(false),
  dressCode: varchar('dress_code', { length: 255 }),
  toolsRequired: varchar('tools_required', { length: 255 }),
  // Nulo = vaga não tem exigência de CNH. Quando preenchida, `cnhRequired`
  // decide se é bloqueante (candidato sem essa CNH nem consegue se
  // candidatar, ver create-application.ts) ou só uma preferência
  // (mostrada como aviso, mas não impede candidatura).
  cnhCategory: cnhCategoryEnum('cnh_category'),
  cnhRequired: boolean('cnh_required').notNull().default(false),
  // Benefícios oferecidos — 'paid' exige o valor em *Amount (ver
  // validateJobInput); 'on_site'/'none' deixam *Amount nulo.
  mealProvision: benefitProvisionEnum('meal_provision').notNull().default('none'),
  mealAmount: numeric('meal_amount', { precision: 10, scale: 2 }),
  transportProvision: benefitProvisionEnum('transport_provision').notNull().default('none'),
  transportAmount: numeric('transport_amount', { precision: 10, scale: 2 }),
  // Default false de propósito — vaga só fica visível/candidatável pra
  // menor de idade (16-17, ver worker_profiles) quando a empresa marca
  // explicitamente que aceita, não o contrário (ver list-nearby-jobs.ts
  // e create-application.ts).
  minorsAllowed: boolean('minors_allowed').notNull().default(false),
  addressLabel: varchar('address_label', { length: 255 }).notNull(),
  locationLat: doublePrecision('location_lat').notNull(),
  locationLng: doublePrecision('location_lng').notNull(),
  positionsTotal: integer('positions_total').notNull(),
  positionsFilled: integer('positions_filled').notNull().default(0),
  payAmount: numeric('pay_amount', { precision: 10, scale: 2 }).notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  // Nulo = usa o padrão (1h antes de startsAt, ver applications-close.ts)
  // — só grava aqui quando a empresa escolhe um prazo próprio.
  applicationsCloseAt: timestamp('applications_close_at', { withTimezone: true }),
  // Aceite explícito de que essa vaga/escala é intermediação avulsa, sem
  // vínculo empregatício — exigido só na criação (ver create-job.ts),
  // nunca alterado numa edição posterior. Mesmo padrão de
  // users.termsAcceptedAt, mas por vaga: dá respaldo jurídico de que a
  // empresa confirmou isso pra cada escala publicada, não só uma vez no cadastro.
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
  // Qual versão de consent_documents (type 'platform_terms') foi aceita —
  // nulo pras vagas criadas antes desse campo existir.
  termsVersion: varchar('terms_version', { length: 20 }),
  termsIpAddress: varchar('terms_ip_address', { length: 64 }),
  termsUserAgent: text('terms_user_agent'),
  // Aceite do termo específico de habilitar candidaturas de 16-17 anos
  // (consent_documents type 'minors_opportunity') — só preenchido quando
  // minorsAllowed é true; exigido em create-job.ts/update-job.ts sempre
  // que minorsAllowed estiver ligado, mesmo padrão do termo geral acima.
  minorsTermsAcceptedAt: timestamp('minors_terms_accepted_at', { withTimezone: true }),
  minorsTermsVersion: varchar('minors_terms_version', { length: 20 }),
  minorsTermsIpAddress: varchar('minors_terms_ip_address', { length: 64 }),
  minorsTermsUserAgent: text('minors_terms_user_agent'),
  status: jobStatusEnum('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
