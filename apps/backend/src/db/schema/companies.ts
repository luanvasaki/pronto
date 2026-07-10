import {
  boolean,
  integer,
  jsonb,
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

export const businessSegmentEnum = pgEnum('business_segment', [
  'bar',
  'restaurante',
  'buffet',
  'hotel',
  'eventos',
  'casa_noturna',
  'outro',
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
    // Endereço só informativo — a distância pro trabalhador é sempre
    // calculada pela localização de cada vaga (jobs.location_lat/lng),
    // não da empresa, então não precisa de lat/lng aqui.
    addressLabel: varchar('address_label', { length: 255 }),
    businessSegment: businessSegmentEnum('business_segment'),
    verificationStatus: companyVerificationStatusEnum('verification_status')
      .notNull()
      .default('pending'),
    avgRating: numeric('avg_rating', { precision: 2, scale: 1 }),
    // Média por categoria (pontualidade no pagamento, clareza...) das
    // avaliações recebidas de trabalhadores — mesmo padrão de
    // worker_profiles.avgCategoryScores, ver update-rating-aggregates.ts.
    avgCategoryScores: jsonb('avg_category_scores').$type<Record<string, string>>(),
    totalJobsPosted: integer('total_jobs_posted').notNull().default(0),
    // Empresa criada só pra popular o app com vagas de exemplo em
    // demonstração — nunca aparece diferente pro trabalhador (mesmos
    // campos, mesmo fluxo), só existe pra dar pra remover tudo de
    // uma vez depois (ver admin/demo-data.ts).
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerUnique: uniqueIndex('companies_owner_user_id_unique').on(table.ownerUserId),
    cnpjUnique: uniqueIndex('companies_cnpj_unique').on(table.cnpj),
  }),
);
