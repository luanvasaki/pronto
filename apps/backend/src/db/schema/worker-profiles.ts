import {
  doublePrecision,
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

export const kycStatusEnum = pgEnum('kyc_status', ['pending', 'approved', 'rejected']);

/**
 * Extensão 1:1 de `users` — só existe pra quem se cadastrou como
 * trabalhador. `userId` é ao mesmo tempo PK e FK, não há `id` próprio.
 */
export const workerProfiles = pgTable(
  'worker_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    // Foto exibida pra empresa decidir se aprova o candidato — diferente
    // do documento de KYC (que é privado, só pro admin ver). Pública de
    // propósito, guardada com `access: 'public'` no Blob.
    photoUrl: varchar('photo_url', { length: 500 }),
    // Breve "sobre mim" — opcional, só pra empresa conhecer melhor o
    // profissional antes de aprovar (tipo currículo curto).
    bio: varchar('bio', { length: 500 }),
    // Só os 11 dígitos, sem formatação — validado por formato na
    // camada de aplicação (mesmo rigor já usado pro CNPJ da empresa,
    // sem checagem de dígito verificador).
    cpf: varchar('cpf', { length: 11 }),
    homeLat: doublePrecision('home_lat'),
    homeLng: doublePrecision('home_lng'),
    // Preenchido por geocodificação reversa (bairro + cidade) quando a
    // localização é salva — só pra exibição ("Campolim, Sorocaba" na
    // tela inicial), nunca usado em cálculo de distância (isso continua
    // sendo direto com homeLat/homeLng). Nulo se a geocodificação falhar
    // ou ainda não tiver rodado.
    homeAddressLabel: varchar('home_address_label', { length: 255 }),
    searchRadiusKm: integer('search_radius_km').notNull().default(10),
    kycStatus: kycStatusEnum('kyc_status').notNull().default('pending'),
    avgRating: numeric('avg_rating', { precision: 2, scale: 1 }),
    // Média por categoria (pontualidade, educação...) das avaliações
    // recebidas de empresas — recalculada do zero junto com avgRating,
    // ver update-rating-aggregates.ts. Mesmo formato (string numérica).
    avgCategoryScores: jsonb('avg_category_scores').$type<Record<string, string>>(),
    // "Mortos" — nunca incrementados por nenhum código (nem check-out,
    // nem marcação de falta). `getWorkerProfile` calcula os números de
    // verdade ao vivo a partir de `shifts`, não confia nessas colunas.
    // Mantidas só pra não quebrar migração; considerar remover quando
    // não houver mais nenhuma leitura delas.
    totalShiftsCompleted: integer('total_shifts_completed').notNull().default(0),
    totalNoShows: integer('total_no_shows').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    cpfUnique: uniqueIndex('worker_profiles_cpf_unique').on(table.cpf),
  }),
);
