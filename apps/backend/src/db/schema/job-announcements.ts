import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { jobs } from './jobs';

/**
 * Aviso da empresa pra vaga — sem cascade em job_id, mesmo raciocínio
 * de `applications`/`jobs` (histórico de negócio, não some se a vaga
 * for removida). Sem coluna de autor: só o dono da empresa da vaga
 * pode publicar (ver create-announcement.ts), então a autoria já é
 * implícita pelo job_id.
 */
export const jobAnnouncements = pgTable('job_announcements', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id')
    .notNull()
    .references(() => jobs.id),
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
