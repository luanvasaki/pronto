import { pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Aceite do "Termo Resumido de Ciência e Utilização" (login_summary em
 * consent_documents) — independente do aceite do documento completo no
 * cadastro (ver users.termsAcceptedAt), roda uma vez por versão. Sem
 * onDelete cascade de propósito: é registro de auditoria, precisa
 * sobreviver mesmo se a conta for excluída no futuro.
 */
export const loginConsents = pgTable(
  'login_consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    version: varchar('version', { length: 20 }).notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userVersionUnique: uniqueIndex('login_consents_user_id_version_unique').on(table.userId, table.version),
  }),
);
