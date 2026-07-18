import { and, eq, gte, inArray, lt, ne } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs, shifts, skillCategories, workerProfiles } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';

export type LiveShiftStatus = 'aguardando' | 'atrasado' | 'chegou' | 'concluido';

/** Ordem de urgência pra ordenar dentro de uma vaga — quem precisa de atenção primeiro. */
const STATUS_URGENCY: Record<LiveShiftStatus, number> = { atrasado: 0, aguardando: 1, chegou: 2, concluido: 3 };

const CHECK_IN_TOLERANCE_MINUTES = 15;

export interface LiveShiftEntry {
  shiftId: string;
  workerId: string;
  workerName: string;
  workerPhotoUrl: string | null;
  status: LiveShiftStatus;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  /** Minutos desde o início previsto do turno — só preenchido quando status é "atrasado". */
  minutesLate: number | null;
}

export interface LiveEventJob {
  jobId: string;
  categoryName: string;
  addressLabel: string;
  startsAt: Date;
  endsAt: Date;
  positionsTotal: number;
  positionsFilled: number;
  shifts: LiveShiftEntry[];
}

export interface LiveEventStatus {
  jobs: LiveEventJob[];
}

/**
 * Status "atrasado"/"aguardando" nunca é lido do banco — é calculado na
 * hora, comparando `now` com `job.startsAt` + tolerância. Não existe (nem
 * precisa existir) nenhum job/cron marcando falta: o enum `no_show` em
 * `shifts.status` existe mas nada nunca escreve nele. Essa é a "central de
 * ações ao vivo": recalculada a cada carga, sem estado próprio pra manter.
 */
export async function getLiveEventStatus(ownerUserId: string, dayStart: Date, dayEnd: Date): Promise<LiveEventStatus> {
  const company = await db.query.companies.findFirst({ where: eq(companies.ownerUserId, ownerUserId) });
  if (!company) {
    throw new HttpError(404, 'Complete o cadastro da empresa antes de ver a operação ao vivo.');
  }

  const dayJobs = await db.query.jobs.findMany({
    where: and(
      eq(jobs.companyId, company.id),
      ne(jobs.status, 'cancelled'),
      gte(jobs.startsAt, dayStart),
      lt(jobs.startsAt, dayEnd),
    ),
    orderBy: (jobsTable, { asc }) => [asc(jobsTable.startsAt)],
  });
  if (dayJobs.length === 0) {
    return { jobs: [] };
  }

  const jobIds = dayJobs.map((job) => job.id);
  const dayShifts = await db.query.shifts.findMany({
    where: and(inArray(shifts.jobId, jobIds), ne(shifts.status, 'cancelled')),
  });

  const workerIds = [...new Set(dayShifts.map((shift) => shift.workerId))];
  const workerRows =
    workerIds.length > 0 ? await db.query.workerProfiles.findMany({ where: inArray(workerProfiles.userId, workerIds) }) : [];
  const workerById = new Map(workerRows.map((worker) => [worker.userId, worker]));

  const categoryIds = [...new Set(dayJobs.map((job) => job.categoryId))];
  const categoryRows =
    categoryIds.length > 0 ? await db.query.skillCategories.findMany({ where: inArray(skillCategories.id, categoryIds) }) : [];
  const categoryNameById = new Map(categoryRows.map((category) => [category.id, category.name]));

  const shiftsByJobId = new Map<string, typeof dayShifts>();
  for (const shift of dayShifts) {
    const list = shiftsByJobId.get(shift.jobId) ?? [];
    list.push(shift);
    shiftsByJobId.set(shift.jobId, list);
  }

  const now = new Date();
  const toleranceMs = CHECK_IN_TOLERANCE_MINUTES * 60 * 1000;

  const jobsResult: LiveEventJob[] = dayJobs.map((job) => {
    const jobShifts = shiftsByJobId.get(job.id) ?? [];

    const shiftEntries: LiveShiftEntry[] = jobShifts.flatMap((shift) => {
      const worker = workerById.get(shift.workerId);
      if (!worker) return [];

      let status: LiveShiftStatus;
      let minutesLate: number | null = null;
      if (shift.status === 'completed' || shift.status === 'checked_out') {
        status = 'concluido';
      } else if (shift.status === 'checked_in') {
        status = 'chegou';
      } else if (now.getTime() > job.startsAt.getTime() + toleranceMs) {
        status = 'atrasado';
        minutesLate = Math.floor((now.getTime() - job.startsAt.getTime()) / 60000);
      } else {
        status = 'aguardando';
      }

      return [
        {
          shiftId: shift.id,
          workerId: shift.workerId,
          workerName: worker.fullName,
          workerPhotoUrl: worker.photoUrl,
          status,
          checkInAt: shift.checkInAt,
          checkOutAt: shift.checkOutAt,
          minutesLate,
        },
      ];
    });

    shiftEntries.sort((a, b) => STATUS_URGENCY[a.status] - STATUS_URGENCY[b.status]);

    return {
      jobId: job.id,
      categoryName: categoryNameById.get(job.categoryId) ?? 'Categoria',
      addressLabel: job.addressLabel,
      startsAt: job.startsAt,
      endsAt: job.endsAt,
      positionsTotal: job.positionsTotal,
      positionsFilled: job.positionsFilled,
      shifts: shiftEntries,
    };
  });

  return { jobs: jobsResult };
}
