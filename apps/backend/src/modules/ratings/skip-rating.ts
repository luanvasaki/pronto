import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs, shifts } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';

export interface SkipRatingResult {
  shiftId: string;
  skippedAt: Date;
}

/**
 * Quem chama é sempre "a outra ponta do turno" — mesma derivação de
 * papel do createRating.ts: se quem chama é o trabalhador do turno,
 * ignora a avaliação dele (workerRatingSkippedAt); senão precisa ser o
 * dono da empresa da vaga, e ignora a avaliação da empresa
 * (companyRatingSkippedAt). Não impede avaliar depois — só é lido
 * enquanto o rating correspondente ainda está vazio (ver
 * list-job-applications.ts/list-my-shifts.ts).
 */
export async function skipRating(raterUserId: string, shiftId: string): Promise<SkipRatingResult> {
  const shift = await db.query.shifts.findFirst({ where: eq(shifts.id, shiftId) });
  if (!shift) {
    throw new HttpError(404, 'Turno não encontrado.');
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

  if (shift.status !== 'completed') {
    throw new HttpError(400, 'Só é possível ignorar a avaliação de turnos concluídos.');
  }

  const [updated] = await db
    .update(shifts)
    .set(raterRole === 'company' ? { companyRatingSkippedAt: new Date() } : { workerRatingSkippedAt: new Date() })
    .where(eq(shifts.id, shiftId))
    .returning();

  const skippedAt = raterRole === 'company' ? updated?.companyRatingSkippedAt : updated?.workerRatingSkippedAt;
  if (!updated || !skippedAt) {
    throw new HttpError(500, 'Não foi possível ignorar a avaliação.');
  }

  return { shiftId: updated.id, skippedAt };
}
