import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { applications, companies, jobs, shifts, workerProfiles, workerSkills } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { getPaymentsByShiftIds } from '../payments/get-payments-by-shift-ids';
import { PaymentResponse } from '../payments/payment-response';
import { getRatingsByShiftIds, ShiftRatings } from '../ratings/get-ratings-by-shift-ids';

export interface JobApplicationResponse {
  id: string;
  status: string;
  createdAt: Date;
  /** Só preenchido quando a empresa desfez uma aprovação — distingue de uma rejeição comum. */
  removedAt: Date | null;
  /** Vaga exige experiência anterior e o candidato não declarou ter — mostra aviso pra quem for aprovar. */
  experienceMismatch: boolean;
  worker: {
    id: string;
    fullName: string;
    photoUrl: string | null;
    avgRating: string | null;
    /** Não tem a categoria da vaga no perfil — mostra aviso pra quem for aprovar. */
    matchesSkills: boolean;
    /** Turnos concluídos com ESSA empresa antes (qualquer vaga) — mostra como vantagem pra quem for aprovar. */
    previousShiftsWithCompany: number;
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

  const skillRows =
    workerIds.length > 0 ? await db.query.workerSkills.findMany({ where: inArray(workerSkills.workerId, workerIds) }) : [];
  const categoryIdsByWorkerId = new Map<string, Set<string>>();
  const hasExperienceByWorkerId = new Map<string, boolean>();
  for (const skill of skillRows) {
    const set = categoryIdsByWorkerId.get(skill.workerId) ?? new Set<string>();
    set.add(skill.categoryId);
    categoryIdsByWorkerId.set(skill.workerId, set);
    if (skill.categoryId === job.categoryId) {
      hasExperienceByWorkerId.set(skill.workerId, skill.hasExperience);
    }
  }

  const applicationIds = rows.map((row) => row.id);
  const shiftRows = await db.query.shifts.findMany({
    where: inArray(shifts.applicationId, applicationIds),
  });
  const shiftsByApplicationId = new Map(shiftRows.map((shift) => [shift.applicationId, shift]));

  const companyJobs = await db.query.jobs.findMany({ where: eq(jobs.companyId, job.companyId) });
  const companyJobIds = companyJobs.map((companyJob) => companyJob.id);
  const previousShiftRows =
    workerIds.length > 0
      ? await db.query.shifts.findMany({
          where: and(
            inArray(shifts.workerId, workerIds),
            inArray(shifts.jobId, companyJobIds),
            eq(shifts.status, 'completed'),
          ),
        })
      : [];
  const previousShiftsCountByWorkerId = new Map<string, number>();
  for (const previousShift of previousShiftRows) {
    previousShiftsCountByWorkerId.set(
      previousShift.workerId,
      (previousShiftsCountByWorkerId.get(previousShift.workerId) ?? 0) + 1,
    );
  }

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
        removedAt: row.removedAt,
        experienceMismatch: job.requiresExperience && !(hasExperienceByWorkerId.get(worker.userId) ?? false),
        worker: {
          id: worker.userId,
          fullName: worker.fullName,
          photoUrl: worker.photoUrl,
          avgRating: worker.avgRating,
          matchesSkills: categoryIdsByWorkerId.get(worker.userId)?.has(job.categoryId) ?? false,
          previousShiftsWithCompany: previousShiftsCountByWorkerId.get(worker.userId) ?? 0,
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
