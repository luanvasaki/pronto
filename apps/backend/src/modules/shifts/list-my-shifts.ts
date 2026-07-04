import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { jobs, shifts } from '../../db/schema';
import { JobResponse, toJobResponse } from '../jobs/job-response';
import { ShiftResponse, toShiftResponse } from './shift-response';

export interface MyShiftResponse extends ShiftResponse {
  job: JobResponse;
}

/** Junta em memória (sem relations() configurado no Drizzle) — mesmo padrão de list-my-applications. */
export async function listMyShifts(workerId: string): Promise<MyShiftResponse[]> {
  const rows = await db.query.shifts.findMany({
    where: eq(shifts.workerId, workerId),
    orderBy: desc(shifts.createdAt),
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
    return [{ ...toShiftResponse(row), job: toJobResponse(job) }];
  });
}
