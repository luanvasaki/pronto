import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { jobQuestions, jobs, workerProfiles } from '../../db/schema';
import { assertOwnsCompany } from '../../shared/assert-owns-company';
import { containsPhoneNumber } from '../../shared/validation/contains-phone-number';
import { HttpError } from '../../shared/errors/http-error';
import { JobQuestionResponse, toQuestionResponse } from './question-response';

/** Só o dono da empresa da vaga da pergunta pode responder. */
export async function answerQuestion(
  ownerUserId: string,
  questionId: string,
  answer: string | undefined,
): Promise<JobQuestionResponse> {
  const question = await db.query.jobQuestions.findFirst({ where: eq(jobQuestions.id, questionId) });
  if (!question) {
    throw new HttpError(404, 'Pergunta não encontrada.');
  }

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, question.jobId) });
  if (!job) {
    throw new HttpError(404, 'Vaga não encontrada.');
  }

  await assertOwnsCompany(ownerUserId, job.companyId, 'Você não tem acesso a essa vaga.');

  const trimmed = answer?.trim();
  if (!trimmed) {
    throw new HttpError(400, 'Escreva a resposta antes de enviar.');
  }
  if (containsPhoneNumber(trimmed)) {
    throw new HttpError(400, 'Não é permitido compartilhar telefone na resposta.');
  }

  const [updated] = await db
    .update(jobQuestions)
    .set({ answer: trimmed, answeredAt: new Date() })
    .where(eq(jobQuestions.id, questionId))
    .returning();
  if (!updated) {
    throw new HttpError(500, 'Não foi possível registrar a resposta.');
  }

  const profile = await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, updated.workerId) });

  return toQuestionResponse(updated, profile?.fullName ?? '');
}
