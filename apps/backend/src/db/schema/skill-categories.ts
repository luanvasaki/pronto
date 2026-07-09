import { pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { workerProfiles } from './worker-profiles';

export const skillCategoryStatusEnum = pgEnum('skill_category_status', ['approved', 'pending', 'rejected']);

/**
 * Deliberadamente plana (sem hierarquia) — o MVP tem 3 categorias
 * fixas. Hierarquia e flags de regulamentação entram quando alguma
 * tela de verdade precisar delas, não antes.
 *
 * `status` default `approved` de propósito — as categorias fixas do
 * MVP não devem virar pendentes numa migração. Só quem entra como
 * `pending` é criada sob demanda por uma empresa ou por um trabalhador
 * (ver create-skill-category.ts) — utilizável na hora, mas visível pro
 * admin revisar/corrigir o nome depois (ver review-skill-category.ts).
 * `createdByCompanyId`/`createdByWorkerId` sem cascade (mesmo motivo de
 * `jobs.company_id`) — no máximo um dos dois é preenchido, nunca os dois.
 */
export const skillCategories = pgTable(
  'skill_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    status: skillCategoryStatusEnum('status').notNull().default('approved'),
    createdByCompanyId: uuid('created_by_company_id').references(() => companies.id),
    createdByWorkerId: uuid('created_by_worker_id').references(() => workerProfiles.userId),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    nameUnique: uniqueIndex('skill_categories_name_unique').on(table.name),
  }),
);
