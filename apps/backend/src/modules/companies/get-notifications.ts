import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { applications, companies, jobs, skillCategories, workerProfiles } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';

const MAX_NOTIFICATIONS = 20;

export interface CompanyNotification {
  applicationId: string;
  jobId: string;
  workerName: string;
  categoryName: string;
  createdAt: Date;
}

export interface CompanyNotifications {
  pendingApplicationsCount: number;
  pendingApplications: CompanyNotification[];
}

/**
 * Só conta/lista candidaturas 'pending' — assim que a empresa
 * aprova/rejeita uma, ela sai sozinha, sem precisar de um campo
 * separado de "lido/não lido". Lista limitada às mais recentes
 * (MAX_NOTIFICATIONS) — o contador reflete o total real, não só o
 * que cabe na lista.
 */
export async function getCompanyNotifications(ownerUserId: string): Promise<CompanyNotifications> {
  const company = await db.query.companies.findFirst({ where: eq(companies.ownerUserId, ownerUserId) });
  if (!company) {
    throw new HttpError(404, 'Complete o cadastro da empresa antes de ver notificações.');
  }

  const companyJobs = await db.query.jobs.findMany({ where: eq(jobs.companyId, company.id) });
  const jobIds = companyJobs.map((job) => job.id);
  if (jobIds.length === 0) {
    return { pendingApplicationsCount: 0, pendingApplications: [] };
  }
  const jobsById = new Map(companyJobs.map((job) => [job.id, job]));

  const [countRow] = await db
    .select({ value: count() })
    .from(applications)
    .where(and(inArray(applications.jobId, jobIds), eq(applications.status, 'pending')));

  const pendingRows = await db.query.applications.findMany({
    where: and(inArray(applications.jobId, jobIds), eq(applications.status, 'pending')),
    orderBy: desc(applications.createdAt),
    limit: MAX_NOTIFICATIONS,
  });

  const workerIds = [...new Set(pendingRows.map((row) => row.workerId))];
  const workerRows =
    workerIds.length > 0 ? await db.query.workerProfiles.findMany({ where: inArray(workerProfiles.userId, workerIds) }) : [];
  const workersById = new Map(workerRows.map((worker) => [worker.userId, worker]));

  const categoryIds = [
    ...new Set(
      pendingRows.flatMap((row) => {
        const categoryId = jobsById.get(row.jobId)?.categoryId;
        return categoryId ? [categoryId] : [];
      }),
    ),
  ];
  const categoryRows =
    categoryIds.length > 0 ? await db.query.skillCategories.findMany({ where: inArray(skillCategories.id, categoryIds) }) : [];
  const categoriesById = new Map(categoryRows.map((category) => [category.id, category]));

  const pendingApplications = pendingRows.flatMap((row) => {
    const job = jobsById.get(row.jobId);
    const worker = workersById.get(row.workerId);
    const category = job ? categoriesById.get(job.categoryId) : undefined;
    if (!job || !worker || !category) {
      return [];
    }
    return [
      {
        applicationId: row.id,
        jobId: row.jobId,
        workerName: worker.fullName,
        categoryName: category.name,
        createdAt: row.createdAt,
      },
    ];
  });

  return { pendingApplicationsCount: countRow?.value ?? 0, pendingApplications };
}
