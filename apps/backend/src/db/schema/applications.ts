import { pgEnum, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { jobs } from './jobs';
import { workerProfiles } from './worker-profiles';

export const applicationStatusEnum = pgEnum('application_status', [
  'pending',
  'approved',
  'rejected',
  'withdrawn',
]);

/**
 * Sem cascade em job_id/worker_id — candidatura é histórico de
 * negócio, mesmo raciocínio de `jobs` (ver comentário lá). O par
 * (job_id, worker_id) é único: não dá pra se candidatar duas vezes
 * à mesma vaga.
 */
export const applications = pgTable(
  'applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id),
    workerId: uuid('worker_id')
      .notNull()
      .references(() => workerProfiles.userId),
    status: applicationStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    jobWorkerUnique: uniqueIndex('applications_job_id_worker_id_unique').on(
      table.jobId,
      table.workerId,
    ),
  }),
);
