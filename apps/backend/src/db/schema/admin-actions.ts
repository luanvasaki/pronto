import { pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const adminActionTypeEnum = pgEnum('admin_action_type', ['grant_admin', 'revoke_admin']);

/**
 * Log de auditoria só-leitura de mudanças em `users.isAdmin` feitas pela
 * UI (ver requireSuperAdmin) — o update direto no banco continua
 * possível e não passa por aqui, mas toda concessão/revogação feita
 * pela tela do admin fica rastreada: quem fez, pra quem, quando. Sem
 * cascade nas FKs (mesmo motivo de `jobs.companyId`): é registro de
 * auditoria, não extensão de identidade — apagar o usuário não deveria
 * apagar o rastro do que ele fez ou sofreu.
 */
export const adminActions = pgTable('admin_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorUserId: uuid('actor_user_id')
    .notNull()
    .references(() => users.id),
  targetUserId: uuid('target_user_id')
    .notNull()
    .references(() => users.id),
  action: adminActionTypeEnum('action').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
