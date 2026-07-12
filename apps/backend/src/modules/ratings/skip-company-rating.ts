import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { jobs, shifts } from '../../db/schema';
import { assertOwnsCompany } from '../../shared/assert-owns-company';
import { HttpError } from '../../shared/errors/http-error';

export interface SkipRatingResult {
  shiftId: string;
  companyRatingSkippedAt: Date;
}

/**
 * Empresa opta por não avaliar um turno concluído — usado quando ela
 * simplesmente não quer avaliar (ou quando o turno tem algum problema
 * de dados que impede a avaliação de verdade, ex.: turno de teste onde
 * a mesma conta era empresa e trabalhador). Não bloqueia avaliar
 * depois: só é lido enquanto `ratings.company` ainda está vazio (ver
 * toApplicationResponse/list-job-applications.ts).
 */
export async function skipCompanyRating(ownerUserId: string, shiftId: string): Promise<SkipRatingResult> {
  const shift = await db.query.shifts.findFirst({ where: eq(shifts.id, shiftId) });
  if (!shift) {
    throw new HttpError(404, 'Turno não encontrado.');
  }

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, shift.jobId) });
  if (!job) {
    throw new HttpError(404, 'Vaga não encontrada.');
  }

  await assertOwnsCompany(ownerUserId, job.companyId, 'Você não tem acesso a esse turno.');

  if (shift.status !== 'completed') {
    throw new HttpError(400, 'Só é possível ignorar a avaliação de turnos concluídos.');
  }

  const [updated] = await db
    .update(shifts)
    .set({ companyRatingSkippedAt: new Date() })
    .where(eq(shifts.id, shiftId))
    .returning();
  if (!updated || !updated.companyRatingSkippedAt) {
    throw new HttpError(500, 'Não foi possível ignorar a avaliação.');
  }

  return { shiftId: updated.id, companyRatingSkippedAt: updated.companyRatingSkippedAt };
}
