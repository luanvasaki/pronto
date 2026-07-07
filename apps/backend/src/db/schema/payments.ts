import { numeric, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { shifts } from './shifts';

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'charged',
  'released',
  'failed',
  'refunded',
]);

/**
 * Campos mínimos de propósito — cobrança e retenção seriam feitas pelo
 * split nativo de um PSP (Pagar.me/Iugu), não por um ledger próprio.
 *
 * Fase atual (decisão de produto, não dívida técnica): nenhum PSP está
 * plugado ainda — `status`/`pspChargeId` são preenchidos pelo
 * `MockPaymentGateway` (ver create-payment-gateway.ts), e o pagamento de
 * verdade é combinado direto entre empresa e trabalhador. Essa tabela
 * só registra em que ponto do processo cada shift está; reintegrar um
 * PSP real depois não muda o schema, só a implementação do gateway.
 */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shiftId: uuid('shift_id')
      .notNull()
      .references(() => shifts.id),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    status: paymentStatusEnum('status').notNull().default('pending'),
    pspChargeId: varchar('psp_charge_id', { length: 100 }),
    chargedAt: timestamp('charged_at', { withTimezone: true }),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    shiftUnique: uniqueIndex('payments_shift_id_unique').on(table.shiftId),
  }),
);
