import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs, ratings, shifts } from '../../db/schema';
import { isRatingRevealed } from './rating-visibility';

export interface WorkerRatingHistoryEntry {
  id: string;
  companyName: string;
  categoryId: string;
  score: number;
  categoryScores: Record<string, number> | null;
  comment: string | null;
  shiftDate: Date;
  createdAt: Date;
}

/**
 * Avaliações que o trabalhador RECEBEU de empresas — só as já reveladas
 * (ver rating-visibility.ts). É a mesma lógica de filtro de
 * update-rating-aggregates.ts, mas retornando o detalhe de cada avaliação
 * em vez da média, pra alimentar "Avaliações recebidas" no perfil.
 */
export async function listWorkerRatings(workerId: string): Promise<WorkerRatingHistoryEntry[]> {
  const workerShifts = await db.query.shifts.findMany({ where: eq(shifts.workerId, workerId) });
  const shiftIds = workerShifts.map((shift) => shift.id);
  if (shiftIds.length === 0) return [];

  const checkOutByShiftId = new Map(workerShifts.map((shift) => [shift.id, shift.checkOutAt]));
  const jobIdByShiftId = new Map(workerShifts.map((shift) => [shift.id, shift.jobId]));

  const allShiftRatings = await db.query.ratings.findMany({ where: inArray(ratings.shiftId, shiftIds) });
  const shiftsWithWorkerRating = new Set(
    allShiftRatings.filter((rating) => rating.raterRole === 'worker').map((rating) => rating.shiftId),
  );
  const receivedRatings = allShiftRatings
    .filter((rating) => rating.raterRole === 'company')
    .filter((rating) =>
      isRatingRevealed(shiftsWithWorkerRating.has(rating.shiftId), checkOutByShiftId.get(rating.shiftId) ?? null),
    );
  if (receivedRatings.length === 0) return [];

  const jobIds = [...new Set(receivedRatings.map((rating) => jobIdByShiftId.get(rating.shiftId)).filter(Boolean))] as string[];
  const jobRows = await db.query.jobs.findMany({ where: inArray(jobs.id, jobIds) });
  const jobsById = new Map(jobRows.map((job) => [job.id, job]));

  const companyIds = [...new Set(jobRows.map((job) => job.companyId))];
  const companyRows = await db.query.companies.findMany({ where: inArray(companies.id, companyIds) });
  const companiesById = new Map(companyRows.map((company) => [company.id, company]));

  return receivedRatings
    .flatMap((rating) => {
      const jobId = jobIdByShiftId.get(rating.shiftId);
      const job = jobId ? jobsById.get(jobId) : undefined;
      const company = job ? companiesById.get(job.companyId) : undefined;
      if (!job || !company) return [];
      return [
        {
          id: rating.id,
          companyName: company.tradeName,
          categoryId: job.categoryId,
          score: rating.score,
          categoryScores: rating.categoryScores ?? null,
          comment: rating.comment,
          shiftDate: checkOutByShiftId.get(rating.shiftId) ?? job.startsAt,
          createdAt: rating.createdAt,
        },
      ];
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
