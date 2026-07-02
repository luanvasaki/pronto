import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';
import { workerProfiles } from './worker-profiles';

export const documentStatusEnum = pgEnum('document_status', ['pending', 'approved', 'rejected']);

/**
 * Só documento de trabalhador por enquanto — empresa é verificada
 * só por CNPJ, sem upload de arquivo, no MVP. `onDelete: cascade`
 * porque isto é extensão de identidade (como worker_profiles), não
 * registro de negócio como jobs/applications/shifts/payments.
 */
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  workerId: uuid('worker_id')
    .notNull()
    .references(() => workerProfiles.userId, { onDelete: 'cascade' }),
  // Caminho no object storage, não uma URL assinada temporária —
  // a URL de acesso é gerada sob demanda pela aplicação.
  fileUrl: text('file_url').notNull(),
  status: documentStatusEnum('status').notNull().default('pending'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
