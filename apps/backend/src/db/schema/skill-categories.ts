import { pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Deliberadamente plana (sem hierarquia) — o MVP tem 3 categorias
 * fixas. Hierarquia e flags de regulamentação entram quando alguma
 * tela de verdade precisar delas, não antes.
 */
export const skillCategories = pgTable(
  'skill_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    nameUnique: uniqueIndex('skill_categories_name_unique').on(table.name),
  }),
);
