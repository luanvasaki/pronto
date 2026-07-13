import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs, ratings, shifts, workerProfiles } from '../../db/schema';

export interface WorkerHistoryEntry {
  workerId: string;
  fullName: string;
  photoUrl: string | null;
  shiftsCompleted: number;
  noShowCount: number;
  /** % (0-100) entre turnos concluídos e turnos resolvidos (concluído + falta). Nulo = ainda sem turno resolvido. */
  attendanceRate: number | null;
  /** Média das notas que ESSA empresa deu a esse trabalhador (não a nota geral dele com todo mundo). */
  avgRatingGiven: string | null;
  lastWorkedAt: Date | null;
}

/**
 * A semente do "grafo de confiança" discutido na reunião: a fatia local do
 * grafo que essa empresa já enxerga — todo trabalhador com quem ela já
 * teve pelo menos um turno resolvido (concluído ou falta), ranqueado por
 * quem é mais confiável primeiro. Não é um grafo à parte — é o mesmo dado
 * de `shifts`/`ratings` que já existe, só que agregado por trabalhador em
 * vez de por vaga (compare com `previousShiftsWithCompany` em
 * list-job-applications.ts, que é o mesmo sinal, mas como contador solto).
 */
export async function getCompanyWorkerHistory(ownerUserId: string): Promise<WorkerHistoryEntry[]> {
  const company = await db.query.companies.findFirst({ where: eq(companies.ownerUserId, ownerUserId) });
  if (!company) {
    return [];
  }

  const companyJobs = await db.query.jobs.findMany({ where: eq(jobs.companyId, company.id) });
  const jobIds = companyJobs.map((job) => job.id);
  if (jobIds.length === 0) {
    return [];
  }

  const companyShifts = await db.query.shifts.findMany({ where: inArray(shifts.jobId, jobIds) });
  if (companyShifts.length === 0) {
    return [];
  }

  interface Aggregate {
    completed: number;
    noShow: number;
    lastWorkedAt: Date | null;
  }
  const byWorkerId = new Map<string, Aggregate>();
  for (const shift of companyShifts) {
    const entry = byWorkerId.get(shift.workerId) ?? { completed: 0, noShow: 0, lastWorkedAt: null };
    if (shift.status === 'completed') {
      entry.completed += 1;
      if (shift.checkOutAt && (!entry.lastWorkedAt || shift.checkOutAt > entry.lastWorkedAt)) {
        entry.lastWorkedAt = shift.checkOutAt;
      }
    } else if (shift.status === 'no_show') {
      entry.noShow += 1;
    }
    byWorkerId.set(shift.workerId, entry);
  }

  const resolvedWorkerIds = [...byWorkerId.entries()]
    .filter(([, entry]) => entry.completed + entry.noShow > 0)
    .map(([workerId]) => workerId);
  if (resolvedWorkerIds.length === 0) {
    return [];
  }

  const workerRows = await db.query.workerProfiles.findMany({ where: inArray(workerProfiles.userId, resolvedWorkerIds) });
  const workerById = new Map(workerRows.map((worker) => [worker.userId, worker]));

  const shiftIds = companyShifts.map((shift) => shift.id);
  const workerIdByShiftId = new Map(companyShifts.map((shift) => [shift.id, shift.workerId]));
  const ratingsGiven = await db.query.ratings.findMany({
    where: and(inArray(ratings.shiftId, shiftIds), eq(ratings.raterRole, 'company')),
  });
  const scoresByWorkerId = new Map<string, number[]>();
  for (const rating of ratingsGiven) {
    const workerId = workerIdByShiftId.get(rating.shiftId);
    if (!workerId) continue;
    const scores = scoresByWorkerId.get(workerId) ?? [];
    scores.push(rating.score);
    scoresByWorkerId.set(workerId, scores);
  }

  const entries: WorkerHistoryEntry[] = resolvedWorkerIds.flatMap((workerId) => {
    const worker = workerById.get(workerId);
    const aggregate = byWorkerId.get(workerId);
    if (!worker || !aggregate) {
      return [];
    }
    const resolvedCount = aggregate.completed + aggregate.noShow;
    const scores = scoresByWorkerId.get(workerId) ?? [];

    return [
      {
        workerId,
        fullName: worker.fullName,
        photoUrl: worker.photoUrl,
        shiftsCompleted: aggregate.completed,
        noShowCount: aggregate.noShow,
        attendanceRate: resolvedCount > 0 ? Math.round((aggregate.completed / resolvedCount) * 100) : null,
        avgRatingGiven: scores.length > 0 ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1) : null,
        lastWorkedAt: aggregate.lastWorkedAt,
      },
    ];
  });

  // Mais confiável primeiro: comparecimento, depois volume de turnos —
  // mesma régua que "chamada rápida de substituto" da reunião vai
  // precisar mais pra frente.
  return entries.sort((a, b) => {
    const rateA = a.attendanceRate ?? -1;
    const rateB = b.attendanceRate ?? -1;
    if (rateA !== rateB) return rateB - rateA;
    return b.shiftsCompleted - a.shiftsCompleted;
  });
}
