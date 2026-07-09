import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { applications, companies, jobs } from '../../db/schema';
import { JobResponse, toJobResponse } from '../jobs/job-response';

export interface MyApplicationResponse {
  id: string;
  status: string;
  workerSeenAt: Date | null;
  createdAt: Date;
  job: JobResponse;
  companyName: string;
}

/** Junta em memória (sem relations() configurado no Drizzle) — mesmo padrão de list-nearby-jobs. */
export async function listMyApplications(workerId: string): Promise<MyApplicationResponse[]> {
  const rows = await db.query.applications.findMany({
    where: eq(applications.workerId, workerId),
    orderBy: desc(applications.createdAt),
  });
  if (rows.length === 0) {
    return [];
  }

  const jobIds = rows.map((row) => row.jobId);
  const jobRows = await db.query.jobs.findMany({ where: inArray(jobs.id, jobIds) });
  const jobsById = new Map(jobRows.map((job) => [job.id, job]));

  const companyIds = [...new Set(jobRows.map((job) => job.companyId))];
  const companyRows =
    companyIds.length > 0 ? await db.query.companies.findMany({ where: inArray(companies.id, companyIds) }) : [];
  const companiesById = new Map(companyRows.map((company) => [company.id, company]));

  return rows.flatMap((row) => {
    const job = jobsById.get(row.jobId);
    if (!job) {
      return [];
    }
    const company = companiesById.get(job.companyId);
    return [
      {
        id: row.id,
        status: row.status,
        workerSeenAt: row.workerSeenAt,
        createdAt: row.createdAt,
        job: toJobResponse(job),
        companyName: company?.tradeName ?? '',
      },
    ];
  });
}
