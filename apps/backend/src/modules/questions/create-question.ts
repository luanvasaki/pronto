import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { applications, jobQuestions, jobs, workerProfiles } from '../../db/schema';
import { containsPhoneNumber } from '../../shared/validation/contains-phone-number';
import { HttpError } from '../../shared/errors/http-error';
import { JobQuestionResponse, toQuestionResponse } from './question-response';

/**
 * Só quem se candidatou (qualquer status) pode perguntar — mesma regra
 * de acesso de list-job-questions/list-job-announcements, já que a
 * pergunta some pública entre os inscritos assim que criada.
 */
export async function createQuestion(
  workerId: string,
  jobId: string,
  question: string | undefined,
): Promise<JobQuestionResponse> {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
  if (!job) {
    throw new HttpError(404, 'Vaga não encontrada.');
  }

  const application = await db.query.applications.findFirst({
    where: and(eq(applications.jobId, jobId), eq(applications.workerId, workerId)),
  });
  if (!application) {
    throw new HttpError(403, 'Você precisa ter se candidatado a essa vaga pra perguntar.');
  }

  const trimmed = question?.trim();
  if (!trimmed) {
    throw new HttpError(400, 'Escreva a pergunta antes de enviar.');
  }
  if (containsPhoneNumber(trimmed)) {
    throw new HttpError(400, 'Não é permitido compartilhar telefone na pergunta.');
  }

  const profile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, workerId) });

  const [created] = await db.insert(jobQuestions).values({ jobId, workerId, question: trimmed }).returning();
  if (!created) {
    throw new HttpError(500, 'Não foi possível enviar a pergunta.');
  }

  return toQuestionResponse(created, profile?.fullName ?? '');
}
