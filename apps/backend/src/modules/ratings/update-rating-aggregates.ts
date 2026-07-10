import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs, ratings, shifts, workerProfiles } from '../../db/schema';
import { isRatingRevealed } from './rating-visibility';

type RatingRow = typeof ratings.$inferSelect;

/**
 * Média por categoria a partir de `categoryScores` de cada avaliação —
 * avaliações antigas (de antes dessa coluna existir) têm `categoryScores`
 * nulo e são ignoradas aqui, mas ainda contam pra `score` geral. Retorna
 * `undefined` se nenhuma avaliação tiver breakdown por categoria ainda.
 */
function averageCategoryScores(ratingRows: RatingRow[]): Record<string, string> | undefined {
  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};

  for (const rating of ratingRows) {
    if (!rating.categoryScores) continue;
    for (const [categoryId, score] of Object.entries(rating.categoryScores)) {
      sums[categoryId] = (sums[categoryId] ?? 0) + score;
      counts[categoryId] = (counts[categoryId] ?? 0) + 1;
    }
  }

  const categoryIds = Object.keys(sums);
  if (categoryIds.length === 0) return undefined;

  return Object.fromEntries(
    categoryIds.map((id) => [id, ((sums[id] ?? 0) / (counts[id] ?? 1)).toFixed(1)]),
  );
}

/**
 * Filtra pras avaliações de `targetRole` sobre esse conjunto de turnos que
 * já estão reveladas (avaliação às cegas — ver rating-visibility.ts): o par
 * do outro lado existe, ou já passou o prazo de 7 dias do check-out.
 */
function revealedRatingsFor(
  targetRole: 'worker' | 'company',
  allRatings: RatingRow[],
  checkOutByShiftId: Map<string, Date | null>,
): RatingRow[] {
  const otherRole = targetRole === 'worker' ? 'company' : 'worker';
  const shiftsWithOtherRole = new Set(
    allRatings.filter((rating) => rating.raterRole === otherRole).map((rating) => rating.shiftId),
  );

  return allRatings
    .filter((rating) => rating.raterRole === targetRole)
    .filter((rating) =>
      isRatingRevealed(shiftsWithOtherRole.has(rating.shiftId), checkOutByShiftId.get(rating.shiftId) ?? null),
    );
}

/**
 * Recalcula a média do zero a cada avaliação nova (ou a cada leitura do
 * perfil — ver getCompanyProfile) em vez de manter um acumulador
 * incremental — no volume do MVP reler tudo é mais simples e não acumula
 * erro de arredondamento. Também é o que permite revelar avaliação por
 * prazo vencido sem precisar de cron: quem lê o perfil já recalcula na
 * hora com o relógio atual.
 */
export async function updateCompanyRatingAggregate(companyId: string): Promise<void> {
  const companyJobs = await db.query.jobs.findMany({ where: eq(jobs.companyId, companyId) });
  const jobIds = companyJobs.map((job) => job.id);
  if (jobIds.length === 0) return;

  const companyShifts = await db.query.shifts.findMany({ where: inArray(shifts.jobId, jobIds) });
  const shiftIds = companyShifts.map((shift) => shift.id);
  if (shiftIds.length === 0) return;
  const checkOutByShiftId = new Map(companyShifts.map((shift) => [shift.id, shift.checkOutAt]));

  const allShiftRatings = await db.query.ratings.findMany({ where: inArray(ratings.shiftId, shiftIds) });
  const companyRatings = revealedRatingsFor('worker', allShiftRatings, checkOutByShiftId);
  if (companyRatings.length === 0) return;

  const average = companyRatings.reduce((sum, rating) => sum + rating.score, 0) / companyRatings.length;
  await db
    .update(companies)
    .set({
      avgRating: average.toFixed(1),
      avgCategoryScores: averageCategoryScores(companyRatings),
      updatedAt: new Date(),
    })
    .where(eq(companies.id, companyId));
}

export async function updateWorkerRatingAggregate(workerId: string): Promise<void> {
  const workerShifts = await db.query.shifts.findMany({ where: eq(shifts.workerId, workerId) });
  const shiftIds = workerShifts.map((shift) => shift.id);
  if (shiftIds.length === 0) return;
  const checkOutByShiftId = new Map(workerShifts.map((shift) => [shift.id, shift.checkOutAt]));

  const allShiftRatings = await db.query.ratings.findMany({ where: inArray(ratings.shiftId, shiftIds) });
  const workerRatings = revealedRatingsFor('company', allShiftRatings, checkOutByShiftId);
  if (workerRatings.length === 0) return;

  const average = workerRatings.reduce((sum, rating) => sum + rating.score, 0) / workerRatings.length;
  await db
    .update(workerProfiles)
    .set({
      avgRating: average.toFixed(1),
      avgCategoryScores: averageCategoryScores(workerRatings),
      updatedAt: new Date(),
    })
    .where(eq(workerProfiles.userId, workerId));
}
