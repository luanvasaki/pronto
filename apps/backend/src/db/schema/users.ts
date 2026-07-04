import { boolean, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Campos deliberadamente mínimos pro escopo do MVP: login é só
 * celular + OTP (sem senha), então não existe `password_hash` aqui.
 * Ver a modelagem de dados completa para os campos que entram depois
 * (locale, timezone, etc.) — não adiantar coluna que nada usa ainda.
 */
export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'banned']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: varchar('phone', { length: 20 }).notNull(),
    email: varchar('email', { length: 255 }),
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
    status: userStatusEnum('status').notNull().default('active'),
    // Sem self-serve pra virar admin — só concedido via update direto
    // no banco (ver README de operações). É deliberadamente rígido:
    // aprovar KYC e verificação de empresa é ação sensível.
    isAdmin: boolean('is_admin').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    phoneUnique: uniqueIndex('users_phone_unique').on(table.phone),
    emailUnique: uniqueIndex('users_email_unique').on(table.email),
  }),
);
