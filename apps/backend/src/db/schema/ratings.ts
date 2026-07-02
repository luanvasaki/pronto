import { check, pgEnum, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { shifts } from './shifts';

export const raterRoleEnum = pgEnum('rater_role', ['worker', 'company']);

/**
 * Um shift tem sempre exatamente um trabalhador e uma empresa — o
 * avaliado nunca precisa ser armazenado, é sempre "a outra ponta do
 * mesmo shift". Sem updated_at: avaliação é registro permanente, não
 * dado editável.
 */
export const ratings = pgTable(
  'ratings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shiftId: uuid('shift_id')
      .notNull()
      .references(() => shifts.id),
    raterRole: raterRoleEnum('rater_role').notNull(),
    score: smallint('score').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    shiftRaterUnique: uniqueIndex('ratings_shift_id_rater_role_unique').on(
      table.shiftId,
      table.raterRole,
    ),
    scoreRange: check('ratings_score_range', sql`${table.score} BETWEEN 1 AND 5`),
  }),
);
