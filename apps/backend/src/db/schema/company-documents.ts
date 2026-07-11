import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { companies } from './companies';

/**
 * Documento de identidade enviado no cadastro de empresa pessoa física
 * (sem CNPJ pra respaldar, ver companies.person_type) — evidência que o
 * admin vê junto dos outros dados da empresa ao aprovar/rejeitar (ver
 * list-pending-verifications.ts). Diferente de `documents` (trabalhador),
 * não tem fluxo de aprovação próprio — a decisão é sobre a empresa
 * inteira, não sobre o documento isoladamente.
 */
export const companyDocuments = pgTable('company_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  fileUrl: text('file_url').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
