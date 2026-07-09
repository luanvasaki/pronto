import { and, count, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { applications, companies, jobs } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';

export interface CompanyNotifications {
  pendingApplicationsCount: number;
}

/**
 * Só conta candidaturas 'pending' — assim que a empresa aprova/rejeita
 * uma, ela sai da contagem sozinha, sem precisar de um campo separado
 * de "lido/não lido".
 */
export async function getCompanyNotifications(ownerUserId: string): Promise<CompanyNotifications> {
  const company = await db.query.companies.findFirst({ where: eq(companies.ownerUserId, ownerUserId) });
  if (!company) {
    throw new HttpError(404, 'Complete o cadastro da empresa antes de ver notificações.');
  }

  const companyJobs = await db.query.jobs.findMany({ where: eq(jobs.companyId, company.id) });
  const jobIds = companyJobs.map((job) => job.id);
  if (jobIds.length === 0) {
    return { pendingApplicationsCount: 0 };
  }

  const [row] = await db
    .select({ value: count() })
    .from(applications)
    .where(and(inArray(applications.jobId, jobIds), eq(applications.status, 'pending')));

  return { pendingApplicationsCount: row?.value ?? 0 };
}
