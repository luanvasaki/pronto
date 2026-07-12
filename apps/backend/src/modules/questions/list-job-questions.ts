import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { jobQuestions, jobs, workerProfiles } from '../../db/schema';
import { assertCanViewJob } from '../../shared/assert-can-view-job';
import { HttpError } from '../../shared/errors/http-error';
import { JobQuestionResponse, toQuestionResponse } from './question-response';

/**
 * Acesso: dono da empresa da vaga OU qualquer inscrito (qualquer
 * status) — mesma regra de list-job-announcements.ts (ver
 * assert-can-view-job.ts). As perguntas são públicas entre todos os
 * inscritos, não só de quem perguntou.
 */
export async function listJobQuestions(userId: string, jobId: string): Promise<JobQuestionResponse[]> {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
  if (!job) {
    throw new HttpError(404, 'Vaga não encontrada.');
  }

  await assertCanViewJob(userId, jobId, job.companyId);

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
