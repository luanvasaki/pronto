import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';
import { workerProfiles } from './worker-profiles';

export const documentStatusEnum = pgEnum('document_status', ['pending', 'approved', 'rejected']);

// `identity` é o documento oficial (RG ou CNH, foto ou PDF); `selfie` é
// a foto do rosto enviada junto, pro admin comparar visualmente e
// confirmar que quem se cadastrou é o dono do documento. `cnh` é
// obrigatório à parte quando o trabalhador declara ter CNH no cadastro
// (worker_profiles.cnh_category preenchido) — o PDF da CNH Digital
// (app oficial do governo), não uma foto, pra comprovar de verdade que
// a categoria informada é válida. Default 'identity' preserva o
// significado dos documentos já enviados antes dessa coluna existir.
export const documentTypeEnum = pgEnum('document_type', ['identity', 'selfie', 'cnh']);

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
  type: documentTypeEnum('type').notNull().default('identity'),
  status: documentStatusEnum('status').notNull().default('pending'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
