import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { jobs, shifts } from '../../db/schema';
import { JobResponse, toJobResponse } from '../jobs/job-response';
import { getPaymentsByShiftIds } from '../payments/get-payments-by-shift-ids';
import { PaymentResponse } from '../payments/payment-response';
import { getRatingsByShiftIds, ShiftRatings } from '../ratings/get-ratings-by-shift-ids';
import { ShiftResponse, toShiftResponse } from './shift-response';

export interface MyShiftResponse extends ShiftResponse {
  job: JobResponse;
  payment: PaymentResponse | null;
  ratings: ShiftRatings;
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

  const shiftIds = rows.map((row) => row.id);
  const [paymentsByShiftId, ratingsByShiftId] = await Promise.all([
    getPaymentsByShiftIds(shiftIds),
    getRatingsByShiftIds(shiftIds),
  ]);

  return rows.flatMap((row) => {
    const job = jobsById.get(row.jobId);
    if (!job) {
      return [];
    }
    return [
      {
        ...toShiftResponse(row),
        job: toJobResponse(job),
        payment: paymentsByShiftId.get(row.id) ?? null,
        ratings: ratingsByShiftId.get(row.id) ?? { worker: null, company: null },
      },
    ];
  });
}
