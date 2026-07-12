import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { applications, companies, jobQuestions, jobs, workerProfiles } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { JobQuestionResponse, toQuestionResponse } from './question-response';

/**
 * Acesso: dono da empresa da vaga OU qualquer inscrito (qualquer
 * status) — mesma regra de list-job-announcements.ts. As perguntas
 * são públicas entre todos os inscritos, não só de quem perguntou.
 */
export async function listJobQuestions(userId: string, jobId: string): Promise<JobQuestionResponse[]> {
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

  const rows = await db.query.jobQuestions.findMany({
    where: eq(jobQuestions.jobId, jobId),
    orderBy: asc(jobQuestions.createdAt),
  });
  if (rows.length === 0) {
    return [];
  }

  const workerIds = [...new Set(rows.map((row) => row.workerId))];
  const workerRows = await db.query.workerProfiles.findMany({ where: inArray(workerProfiles.userId, workerIds) });
  const fullNameByWorkerId = new Map(workerRows.map((worker) => [worker.userId, worker.fullName]));

  return rows.map((row) => toQuestionResponse(row, fullNameByWorkerId.get(row.workerId) ?? ''));
}
