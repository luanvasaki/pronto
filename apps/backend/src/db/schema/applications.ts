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
    // Nulo = trabalhador ainda não viu que foi aprovado — alimenta o
    // alerta "você foi chamado pra esse turno" na tela dele. Só
    // preenchido quando a candidatura já está aprovada.
    workerSeenAt: timestamp('worker_seen_at', { withTimezone: true }),
    // Preenchido quando a empresa desfaz uma aprovação (candidato
    // aceito por engano, por exemplo) — status volta pra 'rejected',
    // mas isso marca que era uma remoção, não uma rejeição comum.
    removedAt: timestamp('removed_at', { withTimezone: true }),
    // Mesmo padrão do workerSeenAt, mas pro alerta de remoção.
    workerSeenRemovalAt: timestamp('worker_seen_removal_at', { withTimezone: true }),
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
