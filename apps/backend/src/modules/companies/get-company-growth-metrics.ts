import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs, shifts } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { buildWeekStarts, GrowthWeek, zeroFill } from '../../shared/growth-weeks';

const WEEKS = 8;

export interface CompanyGrowthMetrics {
  jobsPosted: GrowthWeek[];
  workersHired: GrowthWeek[];
  shiftsCompleted: GrowthWeek[];
}

/**
 * Mesma métrica de crescimento do admin (ver get-growth-metrics.ts),
 * só que recortada pra uma empresa só — dá noção de tendência pro dono
 * do negócio, em vez de só números acumulados (ver get-company-profile.ts).
 * "Contratado" = turno criado (aprovação da candidatura, ver
 * update-application-status.ts); "concluído" = check-out confirmado,
 * mesmo critério usado em todo o resto do produto.
 */
export async function getCompanyGrowthMetrics(ownerUserId: string): Promise<CompanyGrowthMetrics> {
  const company = await db.query.companies.findFirst({ where: eq(companies.ownerUserId, ownerUserId) });
  if (!company) {
    throw new HttpError(404, 'Complete o cadastro da empresa antes de ver o painel.');
  }

  const weekStarts = buildWeekStarts(WEEKS);
  // `WEEKS` é uma constante > 0, então `buildWeekStarts` sempre devolve
  // pelo menos um item — só o `noUncheckedIndexedAccess` do tsconfig
  // exige a checagem de tipo aqui.
  const earliestWeekStart = weekStarts[0]!;

  const jobsPostedRows = await db
    .select({
      weekStart: sql<string>`to_char(date_trunc('week', ${jobs.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)`,
    })
    .from(jobs)
    .where(and(eq(jobs.companyId, company.id), gte(jobs.createdAt, earliestWeekStart)))
    .groupBy(sql`date_trunc('week', ${jobs.createdAt})`);

  const workersHiredRows = await db
    .select({
      weekStart: sql<string>`to_char(date_trunc('week', ${shifts.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)`,
    })
    .from(shifts)
    .innerJoin(jobs, eq(shifts.jobId, jobs.id))
    .where(and(eq(jobs.companyId, company.id), gte(shifts.createdAt, earliestWeekStart)))
    .groupBy(sql`date_trunc('week', ${shifts.createdAt})`);

  const shiftsCompletedRows = await db
    .select({
      weekStart: sql<string>`to_char(date_trunc('week', ${shifts.checkOutAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)`,
    })
    .from(shifts)
    .innerJoin(jobs, eq(shifts.jobId, jobs.id))
    .where(
      and(
        eq(jobs.companyId, company.id),
        eq(shifts.status, 'completed'),
        gte(shifts.checkOutAt, earliestWeekStart),
      ),
    )
    .groupBy(sql`date_trunc('week', ${shifts.checkOutAt})`);

  return {
    jobsPosted: zeroFill(weekStarts, jobsPostedRows.map((row) => ({ weekStart: row.weekStart, count: Number(row.count) }))),
    workersHired: zeroFill(
      weekStarts,
      workersHiredRows.map((row) => ({ weekStart: row.weekStart, count: Number(row.count) })),
    ),
    shiftsCompleted: zeroFill(
      weekStarts,
      shiftsCompletedRows.map((row) => ({ weekStart: row.weekStart, count: Number(row.count) })),
    ),
  };
}
