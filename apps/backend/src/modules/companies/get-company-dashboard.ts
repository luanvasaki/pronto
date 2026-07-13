import { and, eq, gte, inArray, lt, ne } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs, skillCategories } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { CompanyNotifications, getCompanyNotifications } from './get-notifications';

const COVERAGE_WINDOW_HOURS = 48;
const MAX_OPEN_POSITION_JOBS = 10;

export interface CoverageWindow {
  windowHours: number;
  totalPositions: number;
  filledPositions: number;
  /** Nulo quando não há nenhuma vaga na janela — evita mostrar "0%" ou "100%" enganosos. */
  percentage: number | null;
}

export interface OpenPositionJob {
  jobId: string;
  categoryName: string;
  startsAt: Date;
  positionsTotal: number;
  positionsFilled: number;
  openPositions: number;
}

export interface CompanyDashboard {
  coverage: CoverageWindow;
  /** Vagas abertas e futuras com posição vaga — a "central de ações" do painel. */
  openPositionJobs: OpenPositionJob[];
  notifications: CompanyNotifications;
}

/**
 * "Cobertura das próximas 48h" é a métrica-herói do painel: quantas posições
 * já estão preenchidas entre as que precisam de gente até depois de amanhã.
 * `openPositionJobs` é o mesmo recorte de risco, mas linha a linha, pra virar
 * a lista acionável — junto com o que `getCompanyNotifications` já cobre
 * (candidaturas pendentes, check-in não visto, avaliação pendente).
 */
export async function getCompanyDashboard(ownerUserId: string): Promise<CompanyDashboard> {
  const company = await db.query.companies.findFirst({ where: eq(companies.ownerUserId, ownerUserId) });
  if (!company) {
    throw new HttpError(404, 'Complete o cadastro da empresa antes de ver o painel.');
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + COVERAGE_WINDOW_HOURS * 60 * 60 * 1000);

  const coverageJobs = await db.query.jobs.findMany({
    where: and(
      eq(jobs.companyId, company.id),
      ne(jobs.status, 'cancelled'),
      gte(jobs.startsAt, now),
      lt(jobs.startsAt, windowEnd),
    ),
  });
  const totalPositions = coverageJobs.reduce((sum, job) => sum + job.positionsTotal, 0);
  const filledPositions = coverageJobs.reduce((sum, job) => sum + job.positionsFilled, 0);

  const upcomingOpenJobs = await db.query.jobs.findMany({
    where: and(eq(jobs.companyId, company.id), eq(jobs.status, 'open'), gte(jobs.startsAt, now)),
    orderBy: (jobsTable, { asc }) => [asc(jobsTable.startsAt)],
  });
  const jobsWithOpenPositions = upcomingOpenJobs
    .filter((job) => job.positionsFilled < job.positionsTotal)
    .slice(0, MAX_OPEN_POSITION_JOBS);

  const categoryIds = [...new Set(jobsWithOpenPositions.map((job) => job.categoryId))];
  const categoryRows =
    categoryIds.length > 0
      ? await db.query.skillCategories.findMany({ where: inArray(skillCategories.id, categoryIds) })
      : [];
  const categoryNameById = new Map(categoryRows.map((category) => [category.id, category.name]));

  const openPositionJobs: OpenPositionJob[] = jobsWithOpenPositions.map((job) => ({
    jobId: job.id,
    categoryName: categoryNameById.get(job.categoryId) ?? 'Categoria',
    startsAt: job.startsAt,
    positionsTotal: job.positionsTotal,
    positionsFilled: job.positionsFilled,
    openPositions: job.positionsTotal - job.positionsFilled,
  }));

  const notifications = await getCompanyNotifications(ownerUserId, company);

  return {
    coverage: {
      windowHours: COVERAGE_WINDOW_HOURS,
      totalPositions,
      filledPositions,
      percentage: totalPositions > 0 ? Math.round((filledPositions / totalPositions) * 100) : null,
    },
    openPositionJobs,
    notifications,
  };
}
