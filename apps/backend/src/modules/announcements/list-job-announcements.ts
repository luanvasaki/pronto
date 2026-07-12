import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { jobAnnouncements, jobs } from '../../db/schema';
import { assertCanViewJob } from '../../shared/assert-can-view-job';
import { HttpError } from '../../shared/errors/http-error';
import { AnnouncementResponse, toAnnouncementResponse } from './announcement-response';

/**
 * Acesso: dono da empresa da vaga OU qualquer usuário com uma
 * candidatura (qualquer status — pendente, aprovada, rejeitada,
 * retirada) pra essa vaga. Mesma regra de list-job-questions.ts (ver
 * assert-can-view-job.ts).
 */
export async function listJobAnnouncements(userId: string, jobId: string): Promise<AnnouncementResponse[]> {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
  if (!job) {
    throw new HttpError(404, 'Vaga não encontrada.');
  }

  await assertCanViewJob(userId, jobId, job.companyId);

  const rows = await db.query.jobAnnouncements.findMany({
    where: eq(jobAnnouncements.jobId, jobId),
    orderBy: desc(jobAnnouncements.createdAt),
  });

  return rows.map(toAnnouncementResponse);
}
