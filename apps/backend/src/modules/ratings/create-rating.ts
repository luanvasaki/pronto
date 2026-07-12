import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs, ratings, shifts } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { isUniqueViolation } from '../../shared/is-unique-violation';
import { categoriesForRater } from './rating-categories';
import { RatingResponse, toRatingResponse } from './rating-response';
import { updateCompanyRatingAggregate, updateWorkerRatingAggregate } from './update-rating-aggregates';

export interface CreateRatingInput {
  categoryScores: Record<string, number> | undefined;
  comment: string | undefined;
}

/**
 * Valida que `categoryScores` traz exatamente as categorias esperadas
 * pro papel de quem avalia (nem faltando, nem sobrando), cada uma um
 * inteiro de 1 a 5. A nota geral (`score`) não é mais enviada pelo
 * cliente — é a média arredondada dessas categorias, calculada aqui.
 */
function validateCategoryScores(
  raterRole: 'worker' | 'company',
  categoryScores: Record<string, number> | undefined,
): number {
  const expected = categoriesForRater(raterRole);
  if (!categoryScores || typeof categoryScores !== 'object') {
    throw new HttpError(400, 'Avalie todas as categorias, de 1 a 5.');
  }

  const providedKeys = Object.keys(categoryScores);
  const expectedIds = expected.map((category) => category.id);
  const hasAllExpected = expectedIds.every((id) => id in categoryScores);
  const hasNoExtra = providedKeys.every((key) => expectedIds.includes(key));
  if (!hasAllExpected || !hasNoExtra || providedKeys.length !== expectedIds.length) {
    throw new HttpError(400, 'Avalie todas as categorias, de 1 a 5.');
  }

  let sum = 0;
  for (const id of expectedIds) {
    const value = categoryScores[id];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
      throw new HttpError(400, 'Cada categoria precisa de uma nota inteira de 1 a 5.');
    }
    sum += value;
  }

  return Math.round(sum / expectedIds.length);
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

  const score = validateCategoryScores(raterRole, input.categoryScores);

  let rating;
  try {
    [rating] = await db
      .insert(ratings)
      .values({
        shiftId,
        raterRole,
        score,
        categoryScores: input.categoryScores,
        comment: input.comment ?? null,
      })
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

  // Recalcula os dois lados, não só o de quem acabou de ser avaliado: se
  // essa avaliação completa o par do turno, os dois lados ficam revelados
  // no mesmo instante (ver rating-visibility.ts) — sem isso, o lado que já
  // esperava desde a primeira avaliação só atualizaria na próxima vez que
  // alguém o avaliasse de novo (ou abrisse o próprio perfil).
  await Promise.all([updateCompanyRatingAggregate(job.companyId), updateWorkerRatingAggregate(shift.workerId)]);

  return toRatingResponse(rating);
}
