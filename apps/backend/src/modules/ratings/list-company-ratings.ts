import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs, ratings, shifts, workerProfiles } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { isRatingRevealed } from './rating-visibility';

export interface CompanyRatingHistoryEntry {
  id: string;
  workerName: string;
  categoryId: string;
  score: number;
  categoryScores: Record<string, number> | null;
  comment: string | null;
  shiftDate: Date;
  createdAt: Date;
}

/**
 * Avaliações que a empresa RECEBEU de trabalhadores — só as já reveladas
 * (ver rating-visibility.ts). Espelho de list-worker-ratings.ts.
 */
export async function listCompanyRatings(ownerUserId: string): Promise<CompanyRatingHistoryEntry[]> {
  const company = await db.query.companies.findFirst({ where: eq(companies.ownerUserId, ownerUserId) });
  if (!company) {
    throw new HttpError(404, 'Complete o cadastro da empresa antes de ver as avaliações.');
  }

  const companyJobs = await db.query.jobs.findMany({ where: eq(jobs.companyId, company.id) });
  const jobIds = companyJobs.map((job) => job.id);
  if (jobIds.length === 0) return [];
  const jobsById = new Map(companyJobs.map((job) => [job.id, job]));

  const companyShifts = await db.query.shifts.findMany({ where: inArray(shifts.jobId, jobIds) });
  const shiftIds = companyShifts.map((shift) => shift.id);
  if (shiftIds.length === 0) return [];

  const checkOutByShiftId = new Map(companyShifts.map((shift) => [shift.id, shift.checkOutAt]));
  const jobIdByShiftId = new Map(companyShifts.map((shift) => [shift.id, shift.jobId]));
  const workerIdByShiftId = new Map(companyShifts.map((shift) => [shift.id, shift.workerId]));

  const allShiftRatings = await db.query.ratings.findMany({ where: inArray(ratings.shiftId, shiftIds) });
  const shiftsWithCompanyRating = new Set(
    allShiftRatings.filter((rating) => rating.raterRole === 'company').map((rating) => rating.shiftId),
  );
  const receivedRatings = allShiftRatings
    .filter((rating) => rating.raterRole === 'worker')
    .filter((rating) =>
      isRatingRevealed(shiftsWithCompanyRating.has(rating.shiftId), checkOutByShiftId.get(rating.shiftId) ?? null),
    );
  if (receivedRatings.length === 0) return [];

  const workerIds = [...new Set(receivedRatings.map((rating) => workerIdByShiftId.get(rating.shiftId)).filter(Boolean))] as string[];
  const workerRows = await db.query.workerProfiles.findMany({ where: inArray(workerProfiles.userId, workerIds) });
  const workersById = new Map(workerRows.map((worker) => [worker.userId, worker]));

  return receivedRatings
    .flatMap((rating) => {
      const jobId = jobIdByShiftId.get(rating.shiftId);
      const job = jobId ? jobsById.get(jobId) : undefined;
      const workerId = workerIdByShiftId.get(rating.shiftId);
      const worker = workerId ? workersById.get(workerId) : undefined;
      if (!job || !worker) return [];
      return [
        {
          id: rating.id,
          workerName: worker.fullName,
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
