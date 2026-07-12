import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { jobs } from './jobs';
import { workerProfiles } from './worker-profiles';

/**
 * Pergunta de um inscrito sobre a vaga + resposta da empresa (ambas
 * públicas entre todos os inscritos, ver list-job-questions.ts). Sem
 * cascade em job_id/worker_id, mesmo raciocínio de `applications`.
 * `answer`/`answeredAt` nulos = ainda não respondida.
 */
export const jobQuestions = pgTable('job_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id')
    .notNull()
    .references(() => jobs.id),
  workerId: uuid('worker_id')
    .notNull()
    .references(() => workerProfiles.userId),
  question: text('question').notNull(),
  answer: text('answer'),
  answeredAt: timestamp('answered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
