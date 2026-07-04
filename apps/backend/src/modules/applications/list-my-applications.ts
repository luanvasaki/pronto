import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { applications, jobs } from '../../db/schema';
import { JobResponse, toJobResponse } from '../jobs/job-response';

export interface MyApplicationResponse {
  id: string;
  status: string;
  createdAt: Date;
  job: JobResponse;
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

  return rows.flatMap((row) => {
    const job = jobsById.get(row.jobId);
    if (!job) {
      return [];
    }
    return [{ id: row.id, status: row.status, createdAt: row.createdAt, job: toJobResponse(job) }];
  });
}
