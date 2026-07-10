import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs, shifts } from '../../db/schema';
import { updateCompanyRatingAggregate } from '../ratings/update-rating-aggregates';
import { HttpError } from '../../shared/errors/http-error';

export interface CompanyProfileDetails {
  id: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
  logoUrl: string | null;
  addressLabel: string | null;
  businessSegment: string | null;
  verificationStatus: string;
  avgRating: string | null;
  avgCategoryScores: Record<string, string> | null;
  totalJobsPosted: number;
  jobsPosted: number;
  shiftsCompleted: number;
  rehireRate: number | null;
}

export async function getCompanyProfile(ownerUserId: string): Promise<CompanyProfileDetails> {
  const existing = await db.query.companies.findFirst({ where: eq(companies.ownerUserId, ownerUserId) });
  if (!existing) {
    throw new HttpError(404, 'Complete o cadastro da empresa antes de ver o perfil.');
  }

  // Recalcula antes de ler — mesmo motivo de getWorkerProfile.ts: pega
  // avaliação que só ficou visível agora pelo prazo de 7 dias vencer, sem
  // precisar de uma avaliação nova pra disparar o recalculo.
  await updateCompanyRatingAggregate(existing.id);
  const company = (await db.query.companies.findFirst({ where: eq(companies.id, existing.id) })) ?? existing;

  // `company.totalJobsPosted` nunca é incrementada em código nenhum (só em
  // teste) — mesmo problema já resolvido pro admin em list-companies.ts.
  // `jobsPosted` conta ao vivo e é o que a tela deveria mostrar.
  const [{ jobsPosted = 0 } = { jobsPosted: 0 }] = await db
    .select({ jobsPosted: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.companyId, company.id));

  // Taxa de recontratação: turnos concluídos agrupados por trabalhador —
  // quantos trabalhadores essa empresa contratou pelo menos 1x, e quantos
  // desses ela chamou de novo (2+). `shiftsCompleted` sai de graça da mesma
  // consulta (soma dos turnos concluídos de cada trabalhador).
  const workerShiftCounts = await db
    .select({
      workerId: shifts.workerId,
      completedCount: sql<string>`count(*) filter (where ${shifts.status} = 'completed')`,
    })
    .from(shifts)
    .innerJoin(jobs, eq(shifts.jobId, jobs.id))
    .where(eq(jobs.companyId, company.id))
    .groupBy(shifts.workerId);

  const shiftsCompleted = workerShiftCounts.reduce((sum, row) => sum + Number(row.completedCount), 0);
  const workersHired = workerShiftCounts.filter((row) => Number(row.completedCount) >= 1).length;
  const workersRehired = workerShiftCounts.filter((row) => Number(row.completedCount) >= 2).length;

  return {
    id: company.id,
    legalName: company.legalName,
    tradeName: company.tradeName,
    cnpj: company.cnpj,
    logoUrl: company.logoUrl,
    addressLabel: company.addressLabel,
    businessSegment: company.businessSegment,
    verificationStatus: company.verificationStatus,
    avgRating: company.avgRating,
    avgCategoryScores: company.avgCategoryScores ?? null,
    totalJobsPosted: company.totalJobsPosted,
    jobsPosted: Number(jobsPosted),
    shiftsCompleted,
    rehireRate: workersHired > 0 ? Math.round((workersRehired / workersHired) * 100) : null,
  };
}
