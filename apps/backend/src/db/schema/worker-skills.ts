import { boolean, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { skillCategories } from './skill-categories';
import { workerProfiles } from './worker-profiles';

/**
 * N:N entre trabalhador e categoria — um trabalhador pode fazer bico
 * em mais de uma. Cascade em worker_id (extensão de identidade),
 * sem cascade em category_id (categoria é praticamente imutável).
 *
 * `hasExperience` é declarado pelo próprio trabalhador (não verificado)
 * — "já trabalhei nessa função antes", independente das horas reais
 * ganhas na plataforma (essas continuam vindo ao vivo de `shifts`).
 */
export const workerSkills = pgTable(
  'worker_skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workerId: uuid('worker_id')
      .notNull()
      .references(() => workerProfiles.userId, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => skillCategories.id),
    hasExperience: boolean('has_experience').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workerCategoryUnique: uniqueIndex('worker_skills_worker_id_category_id_unique').on(
      table.workerId,
      table.categoryId,
    ),
  }),
);
