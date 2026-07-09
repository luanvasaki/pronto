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
  addressLabel: varchar('address_label', { length: 255 }).notNull(),
  locationLat: doublePrecision('location_lat').notNull(),
  locationLng: doublePrecision('location_lng').notNull(),
  positionsTotal: integer('positions_total').notNull(),
  positionsFilled: integer('positions_filled').notNull().default(0),
  payAmount: numeric('pay_amount', { precision: 10, scale: 2 }).notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  status: jobStatusEnum('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
