import { sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, shifts, workerProfiles } from '../../db/schema';

const WEEKS = 8;

export interface GrowthWeek {
  /** Segunda-feira da semana, ISO date (yyyy-mm-dd). */
  weekStart: string;
  count: number;
}

export interface AdminGrowthMetrics {
  companies: GrowthWeek[];
  workers: GrowthWeek[];
  dealsClosed: GrowthWeek[];
}

/**
 * Últimas WEEKS semanas (segunda a domingo), mais antiga primeiro,
 * com semanas sem registro zeradas — o GROUP BY do Postgres simplesmente
 * pula semana vazia, e o gráfico precisa do buraco pra ler como zero.
 */
function buildWeekStarts(weeks: number): Date[] {
  const now = new Date();
  const dayOfWeek = (now.getUTCDay() + 6) % 7; // 0 = segunda
  const currentWeekStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOfWeek),
  );

  const starts: Date[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    starts.push(new Date(currentWeekStart.getTime() - i * 7 * 24 * 60 * 60 * 1000));
  }
  return starts;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function zeroFill(weekStarts: Date[], rows: { weekStart: string; count: number }[]): GrowthWeek[] {
  const countByWeek = new Map(rows.map((row) => [row.weekStart, row.count]));
  return weekStarts.map((weekStart) => {
    const iso = toIsoDate(weekStart);
    return { weekStart: iso, count: countByWeek.get(iso) ?? 0 };
  });
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
