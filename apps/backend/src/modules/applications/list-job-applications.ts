import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { applications, companies, jobs, workerProfiles } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';

export interface JobApplicationResponse {
  id: string;
  status: string;
  createdAt: Date;
  worker: {
    id: string;
    fullName: string;
    avgRating: string | null;
  };
}

/** Só o dono da empresa da vaga pode ver os candidatos dela. */
export async function listJobApplications(
  ownerUserId: string,
  jobId: string,
): Promise<JobApplicationResponse[]> {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
  if (!job) {
    throw new HttpError(404, 'Vaga não encontrada.');
  }

  const company = await db.query.companies.findFirst({ where: eq(companies.id, job.companyId) });
  if (!company || company.ownerUserId !== ownerUserId) {
    throw new HttpError(403, 'Você não tem acesso a essa vaga.');
  }

  const rows = await db.query.applications.findMany({
    where: eq(applications.jobId, jobId),
    orderBy: desc(applications.createdAt),
  });
  if (rows.length === 0) {
    return [];
  }

  const workerIds = rows.map((row) => row.workerId);
  const workerRows = await db.query.workerProfiles.findMany({
    where: inArray(workerProfiles.userId, workerIds),
  });
  const workersById = new Map(workerRows.map((worker) => [worker.userId, worker]));

  return rows.flatMap((row) => {
    const worker = workersById.get(row.workerId);
    if (!worker) {
      return [];
    }
    return [
      {
        id: row.id,
        status: row.status,
        createdAt: row.createdAt,
        worker: { id: worker.userId, fullName: worker.fullName, avgRating: worker.avgRating },
      },
    ];
  });
}
