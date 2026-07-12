import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { applications, companies, jobAnnouncements, jobs } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { AnnouncementResponse, toAnnouncementResponse } from './announcement-response';

/**
 * Acesso: dono da empresa da vaga OU qualquer usuário com uma
 * candidatura (qualquer status — pendente, aprovada, rejeitada,
 * retirada) pra essa vaga. Mesma regra de list-job-questions.ts.
 */
export async function listJobAnnouncements(userId: string, jobId: string): Promise<AnnouncementResponse[]> {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
  if (!job) {
    throw new HttpError(404, 'Vaga não encontrada.');
  }

  const company = await db.query.companies.findFirst({ where: eq(companies.id, job.companyId) });
  const isOwner = company?.ownerUserId === userId;

  if (!isOwner) {
    const application = await db.query.applications.findFirst({
      where: and(eq(applications.jobId, jobId), eq(applications.workerId, userId)),
    });
    if (!application) {
      throw new HttpError(403, 'Você não tem acesso a essa vaga.');
    }
  }

  const rows = await db.query.jobAnnouncements.findMany({
    where: eq(jobAnnouncements.jobId, jobId),
    orderBy: desc(jobAnnouncements.createdAt),
  });

  return rows.map(toAnnouncementResponse);
}
