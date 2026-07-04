import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs, ratings, shifts, workerProfiles } from '../../db/schema';

/**
 * Recalcula a média do zero a cada avaliação nova em vez de manter um
 * acumulador incremental — no volume do MVP reler tudo é mais simples
 * e não acumula erro de arredondamento.
 */
export async function updateCompanyRatingAggregate(companyId: string): Promise<void> {
  const companyJobs = await db.query.jobs.findMany({ where: eq(jobs.companyId, companyId) });
  const jobIds = companyJobs.map((job) => job.id);
  if (jobIds.length === 0) return;

  const companyShifts = await db.query.shifts.findMany({ where: inArray(shifts.jobId, jobIds) });
  const shiftIds = companyShifts.map((shift) => shift.id);
  if (shiftIds.length === 0) return;

  const companyRatings = await db.query.ratings.findMany({
    where: and(inArray(ratings.shiftId, shiftIds), eq(ratings.raterRole, 'worker')),
  });
  if (companyRatings.length === 0) return;

  const average = companyRatings.reduce((sum, rating) => sum + rating.score, 0) / companyRatings.length;
  await db
    .update(companies)
    .set({ avgRating: average.toFixed(1), updatedAt: new Date() })
    .where(eq(companies.id, companyId));
}

export async function updateWorkerRatingAggregate(workerId: string): Promise<void> {
  const workerShifts = await db.query.shifts.findMany({ where: eq(shifts.workerId, workerId) });
  const shiftIds = workerShifts.map((shift) => shift.id);
  if (shiftIds.length === 0) return;

  const workerRatings = await db.query.ratings.findMany({
    where: and(inArray(ratings.shiftId, shiftIds), eq(ratings.raterRole, 'company')),
  });
  if (workerRatings.length === 0) return;

  const average = workerRatings.reduce((sum, rating) => sum + rating.score, 0) / workerRatings.length;
  await db
    .update(workerProfiles)
    .set({ avgRating: average.toFixed(1), updatedAt: new Date() })
    .where(eq(workerProfiles.userId, workerId));
}
