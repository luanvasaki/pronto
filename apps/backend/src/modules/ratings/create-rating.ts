import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs, ratings, shifts } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { RatingResponse, toRatingResponse } from './rating-response';
import { updateCompanyRatingAggregate, updateWorkerRatingAggregate } from './update-rating-aggregates';

/**
 * A checagem de duplicata abaixo previne o caso comum, mas não fecha a
 * corrida entre duas requisições simultâneas — o índice único
 * `ratings_shift_id_rater_role_unique` pega isso de verdade; aqui só
 * traduz o erro cru do Postgres pra mensagem amigável (mesmo padrão de
 * create-application.ts).
 */
function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  const causeCode = (error.cause as { code?: unknown } | undefined)?.code;
  return code === '23505' || causeCode === '23505';
}

export interface CreateRatingInput {
  score: number | undefined;
  comment: string | undefined;
}

/**
 * Quem avalia é sempre "a outra ponta do turno": o trabalhador avalia
 * a empresa, a empresa avalia o trabalhador — por isso o papel do
 * avaliador (`raterRole`) é derivado da identidade de quem chama, não
 * enviado pelo cliente.
 */
export async function createRating(
  raterUserId: string,
  shiftId: string,
  input: CreateRatingInput,
): Promise<RatingResponse> {
  if (
    typeof input.score !== 'number' ||
    !Number.isInteger(input.score) ||
    input.score < 1 ||
    input.score > 5
  ) {
    throw new HttpError(400, 'Nota inválida — use um número inteiro de 1 a 5.');
  }

  const shift = await db.query.shifts.findFirst({ where: eq(shifts.id, shiftId) });
  if (!shift) {
    throw new HttpError(404, 'Turno não encontrado.');
  }
  if (shift.status !== 'completed') {
    throw new HttpError(400, 'Só é possível avaliar turnos concluídos.');
  }

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, shift.jobId) });
  if (!job) {
    throw new HttpError(404, 'Vaga não encontrada.');
  }

  let raterRole: 'worker' | 'company';
  if (shift.workerId === raterUserId) {
    raterRole = 'worker';
  } else {
    const company = await db.query.companies.findFirst({ where: eq(companies.id, job.companyId) });
    if (!company || company.ownerUserId !== raterUserId) {
      throw new HttpError(403, 'Você não tem acesso a esse turno.');
    }
    raterRole = 'company';
  }

  let rating;
  try {
    [rating] = await db
      .insert(ratings)
      .values({ shiftId, raterRole, score: input.score, comment: input.comment ?? null })
      .returning();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new HttpError(400, 'Você já avaliou esse turno.');
    }
    throw error;
  }
  if (!rating) {
    throw new HttpError(500, 'Não foi possível registrar a avaliação.');
  }

  if (raterRole === 'worker') {
    await updateCompanyRatingAggregate(job.companyId);
  } else {
    await updateWorkerRatingAggregate(shift.workerId);
  }

  return toRatingResponse(rating);
}
