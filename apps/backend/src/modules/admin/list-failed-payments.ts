import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs, payments, shifts, workerProfiles } from '../../db/schema';

export interface FailedPayment {
  id: string;
  shiftId: string;
  amount: string;
  companyName: string;
  workerFullName: string;
  createdAt: Date;
}

/**
 * chargeForShift (ver charge-for-shift.ts) deixa o pagamento "failed"
 * pra sempre quando o gateway falha, sem retry automático nem alerta —
 * decisão de produto pro estágio atual (gateway ainda é mock, então
 * isso só acontece por bug, não por recusa de PSP de verdade). Esse
 * endpoint é o mínimo pra alguém saber que existe algo pra resolver:
 * lista pra um admin ver e agir manualmente, sem fila nem retry.
 */
export async function listFailedPayments(): Promise<FailedPayment[]> {
  const failedPayments = await db.query.payments.findMany({ where: eq(payments.status, 'failed') });
  if (failedPayments.length === 0) {
    return [];
  }

  const shiftIds = failedPayments.map((payment) => payment.shiftId);
  const shiftRows = await db.query.shifts.findMany({ where: inArray(shifts.id, shiftIds) });
  const shiftsById = new Map(shiftRows.map((shift) => [shift.id, shift]));

  const jobIds = [...new Set(shiftRows.map((shift) => shift.jobId))];
  const jobRows = jobIds.length > 0 ? await db.query.jobs.findMany({ where: inArray(jobs.id, jobIds) }) : [];
  const jobsById = new Map(jobRows.map((job) => [job.id, job]));

  const companyIds = [...new Set(jobRows.map((job) => job.companyId))];
  const companyRows =
    companyIds.length > 0 ? await db.query.companies.findMany({ where: inArray(companies.id, companyIds) }) : [];
  const companiesById = new Map(companyRows.map((company) => [company.id, company]));

  const workerIds = shiftRows.map((shift) => shift.workerId);
  const workerRows =
    workerIds.length > 0
      ? await db.query.workerProfiles.findMany({ where: inArray(workerProfiles.userId, workerIds) })
      : [];
  const workersById = new Map(workerRows.map((worker) => [worker.userId, worker]));

  return failedPayments.flatMap((payment) => {
    const shift = shiftsById.get(payment.shiftId);
    if (!shift) return [];
    const job = jobsById.get(shift.jobId);
    const company = job ? companiesById.get(job.companyId) : undefined;
    const worker = workersById.get(shift.workerId);

    return [
      {
        id: payment.id,
        shiftId: payment.shiftId,
        amount: payment.amount,
        companyName: company?.tradeName ?? '',
        workerFullName: worker?.fullName ?? '',
        createdAt: payment.createdAt,
      },
    ];
  });
}
