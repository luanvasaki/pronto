import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { applications, companies, jobs, shifts, workerProfiles } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { getPaymentsByShiftIds } from '../payments/get-payments-by-shift-ids';
import { PaymentResponse } from '../payments/payment-response';
import { getRatingsByShiftIds, ShiftRatings } from '../ratings/get-ratings-by-shift-ids';

export interface JobApplicationResponse {
  id: string;
  status: string;
  createdAt: Date;
  worker: {
    id: string;
    fullName: string;
    photoUrl: string | null;
    avgRating: string | null;
  };
  shift: {
    id: string;
    status: string;
    checkInAt: Date | null;
    checkOutAt: Date | null;
    payment: PaymentResponse | null;
    ratings: ShiftRatings;
  } | null;
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

  const applicationIds = rows.map((row) => row.id);
  const shiftRows = await db.query.shifts.findMany({
    where: inArray(shifts.applicationId, applicationIds),
  });
  const shiftsByApplicationId = new Map(shiftRows.map((shift) => [shift.applicationId, shift]));

  const shiftIds = shiftRows.map((shift) => shift.id);
  const [paymentsByShiftId, ratingsByShiftId] = await Promise.all([
    getPaymentsByShiftIds(shiftIds),
    getRatingsByShiftIds(shiftIds),
  ]);

  return rows.flatMap((row) => {
    const worker = workersById.get(row.workerId);
    if (!worker) {
      return [];
    }
    const shift = shiftsByApplicationId.get(row.id);
    return [
      {
        id: row.id,
        status: row.status,
        createdAt: row.createdAt,
        worker: {
          id: worker.userId,
          fullName: worker.fullName,
          photoUrl: worker.photoUrl,
          avgRating: worker.avgRating,
        },
        shift: shift
          ? {
              id: shift.id,
              status: shift.status,
              checkInAt: shift.checkInAt,
              checkOutAt: shift.checkOutAt,
              payment: paymentsByShiftId.get(shift.id) ?? null,
              ratings: ratingsByShiftId.get(shift.id) ?? { worker: null, company: null },
            }
          : null,
      },
    ];
  });
}
