import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs } from '../../db/schema';
import { JobResponse, toJobResponse } from './job-response';

/** Lista vazia pra quem ainda não tem empresa — a tela decide o que mostrar. */
export async function listMyJobs(ownerUserId: string): Promise<JobResponse[]> {
  const company = await db.query.companies.findFirst({ where: eq(companies.ownerUserId, ownerUserId) });
  if (!company) {
    return [];
  }

  const rows = await db.query.jobs.findMany({
    where: eq(jobs.companyId, company.id),
    orderBy: desc(jobs.createdAt),
  });

  return rows.map(toJobResponse);
}
