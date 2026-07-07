import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Mesmo princípio do refresh token — só o hash é guardado, nunca o
 * valor em claro. `usedAt` marca uso único (diferente do refresh
 * token, aqui não existe lógica de "reuso implica roubo": só rejeita
 * se já foi usado ou expirou).
 */
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex('password_reset_tokens_token_hash_unique').on(table.tokenHash),
  }),
);
