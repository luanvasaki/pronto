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
  status: jobStatusEnum('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
