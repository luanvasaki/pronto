import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Uma linha por dispositivo/navegador inscrito, não por usuário — a mesma
 * pessoa pode ter o painel aberto no computador e no celular ao mesmo
 * tempo, e cada um tem seu próprio `endpoint` do serviço de push do
 * navegador (FCM no Chrome, etc.). `endpoint` é único globalmente: se o
 * navegador gerar um novo `endpoint` pra quem já tinha inscrição (rotação
 * natural do PushManager), o insert vira update em vez de duplicar linha.
 * onDelete cascade: sem o usuário, a inscrição não serve pra nada.
 */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    endpointUnique: uniqueIndex('push_subscriptions_endpoint_unique').on(table.endpoint),
  }),
);
