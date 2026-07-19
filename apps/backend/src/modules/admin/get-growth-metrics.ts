import { sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, shifts, workerProfiles } from '../../db/schema';
import { buildWeekStarts, GrowthWeek, zeroFill } from '../../shared/growth-weeks';

const WEEKS = 8;

export interface AdminGrowthMetrics {
  companies: GrowthWeek[];
  workers: GrowthWeek[];
  dealsClosed: GrowthWeek[];
}

/**
 * "Negociações fechadas" = escalas concluídas (mesmo critério de
 * get-metrics.ts: shifts com status 'completed'), agrupadas por semana
 * do check-out.
 */
export async function getAdminGrowthMetrics(): Promise<AdminGrowthMetrics> {
  const weekStarts = buildWeekStarts(WEEKS);
  const earliestWeekStart = weekStarts[0];

  const companyRows = await db
    .select({
      weekStart: sql<string>`to_char(date_trunc('week', ${companies.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)`,
    })
    .from(companies)
    .where(sql`${companies.createdAt} >= ${earliestWeekStart}`)
    .groupBy(sql`date_trunc('week', ${companies.createdAt})`);

  const workerRows = await db
    .select({
      weekStart: sql<string>`to_char(date_trunc('week', ${workerProfiles.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)`,
    })
    .from(workerProfiles)
    .where(sql`${workerProfiles.createdAt} >= ${earliestWeekStart}`)
    .groupBy(sql`date_trunc('week', ${workerProfiles.createdAt})`);

  const dealRows = await db
    .select({
      weekStart: sql<string>`to_char(date_trunc('week', ${shifts.checkOutAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)`,
    })
    .from(shifts)
    .where(sql`${shifts.status} = 'completed' and ${shifts.checkOutAt} >= ${earliestWeekStart}`)
    .groupBy(sql`date_trunc('week', ${shifts.checkOutAt})`);

  return {
    companies: zeroFill(weekStarts, companyRows.map((row) => ({ weekStart: row.weekStart, count: Number(row.count) }))),
    workers: zeroFill(weekStarts, workerRows.map((row) => ({ weekStart: row.weekStart, count: Number(row.count) }))),
    dealsClosed: zeroFill(weekStarts, dealRows.map((row) => ({ weekStart: row.weekStart, count: Number(row.count) }))),
  };
}
