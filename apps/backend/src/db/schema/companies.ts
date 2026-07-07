import {
  integer,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const companyVerificationStatusEnum = pgEnum('company_verification_status', [
  'pending',
  'approved',
  'rejected',
]);

/**
 * Empresa é uma entidade própria, não extensão de `users` — uma
 * empresa não é a mesma coisa que a pessoa que a administra.
 * `ownerUserId` é único por enquanto (MVP: um dono só); multiusuário
 * vira uma tabela `company_members` quando existir demanda real.
 */
export const companies = pgTable(
  'companies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    legalName: varchar('legal_name', { length: 255 }).notNull(),
    tradeName: varchar('trade_name', { length: 255 }).notNull(),
    cnpj: varchar('cnpj', { length: 14 }).notNull(),
    // Opcional (diferente da foto do trabalhador, que é obrigatória) —
    // pública no Blob, mesmo padrão do `photoUrl` de worker_profiles.
    logoUrl: varchar('logo_url', { length: 500 }),
    verificationStatus: companyVerificationStatusEnum('verification_status')
      .notNull()
      .default('pending'),
    avgRating: numeric('avg_rating', { precision: 2, scale: 1 }),
    totalJobsPosted: integer('total_jobs_posted').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerUnique: uniqueIndex('companies_owner_user_id_unique').on(table.ownerUserId),
    cnpjUnique: uniqueIndex('companies_cnpj_unique').on(table.cnpj),
  }),
);
