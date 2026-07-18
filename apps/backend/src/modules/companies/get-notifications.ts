import { and, count, desc, inArray, isNull, or, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { applications, companies, jobs, shifts, skillCategories, workerProfiles } from '../../db/schema';
import { getRatingsByShiftIds } from '../ratings/get-ratings-by-shift-ids';
import { HttpError } from '../../shared/errors/http-error';

const MAX_NOTIFICATIONS = 20;

export interface CompanyNotification {
  applicationId: string;
  jobId: string;
  workerName: string;
  categoryName: string;
  createdAt: Date;
}

export interface CheckedInNotification {
  shiftId: string;
  jobId: string;
  workerName: string;
  categoryName: string;
  checkInAt: Date;
}

export interface CheckedOutNotification {
  shiftId: string;
  jobId: string;
  workerName: string;
  categoryName: string;
  checkOutAt: Date;
}

export interface PendingRatingNotification {
  shiftId: string;
  jobId: string;
  workerName: string;
  categoryName: string;
  checkOutAt: Date;
}

export interface CompanyNotifications {
  pendingApplicationsCount: number;
  pendingApplications: CompanyNotification[];
  checkedInCount: number;
  checkedInNotifications: CheckedInNotification[];
  checkedOutCount: number;
  checkedOutNotifications: CheckedOutNotification[];
  pendingRatingsCount: number;
  pendingRatingsNotifications: PendingRatingNotification[];
}

/**
 * Só conta/lista candidaturas 'pending' — assim que a empresa
 * aprova/rejeita uma, ela sai sozinha, sem precisar de um campo
 * separado de "lido/não lido". Lista limitada às mais recentes
 * (MAX_NOTIFICATIONS) — o contador reflete o total real, não só o
 * que cabe na lista.
 *
 * Check-ins e check-outs seguem o mesmo espírito, mas com confirmação de
 * verdade (`shifts.checkInConfirmedAt`/`checkOutConfirmedAt`) em vez de
 * "lido/não lido" — a lista só esvazia quando a empresa de fato confirma
 * a chegada/saída na página da vaga (ver confirm-check-in.ts e
 * confirm-check-out.ts), não só por abrir o sino. Check-in aparece tanto
 * em 'checked_in' quanto em 'checked_out' porque as duas confirmações
 * são independentes — o trabalhador pode já ter saído antes da empresa
 * confirmar a chegada.
 *
 * Avaliação pendente também não precisa de "lido/não lido" próprio —
 * o próprio ato de avaliar (criar a linha em `ratings`) já tira o
 * turno da lista, igual às candidaturas pendentes.
 *
 * `preloadedCompany` deixa quem já resolveu a empresa (ex: getCompanyDashboard)
 * pular essa mesma busca de novo — sem mudar o comportamento de quem chama
 * só com `ownerUserId`, que continua buscando sozinho.
 */
export async function getCompanyNotifications(
  ownerUserId: string,
  preloadedCompany?: typeof companies.$inferSelect,
): Promise<CompanyNotifications> {
  const company = preloadedCompany ?? (await db.query.companies.findFirst({ where: eq(companies.ownerUserId, ownerUserId) }));
  if (!company) {
    throw new HttpError(404, 'Complete o cadastro da empresa antes de ver notificações.');
  }

  const companyJobs = await db.query.jobs.findMany({ where: eq(jobs.companyId, company.id) });
  const jobIds = companyJobs.map((job) => job.id);
  if (jobIds.length === 0) {
    return {
      pendingApplicationsCount: 0,
      pendingApplications: [],
      checkedInCount: 0,
      checkedInNotifications: [],
      checkedOutCount: 0,
      checkedOutNotifications: [],
      pendingRatingsCount: 0,
      pendingRatingsNotifications: [],
    };
  }
  const jobsById = new Map(companyJobs.map((job) => [job.id, job]));

  const [countRow] = await db
    .select({ value: count() })
    .from(applications)
    .where(and(inArray(applications.jobId, jobIds), eq(applications.status, 'pending')));

  const pendingRows = await db.query.applications.findMany({
    where: and(inArray(applications.jobId, jobIds), eq(applications.status, 'pending')),
    orderBy: desc(applications.createdAt),
    limit: MAX_NOTIFICATIONS,
  });

  const checkedInStatusFilter = or(eq(shifts.status, 'checked_in'), eq(shifts.status, 'checked_out'));

  const [checkedInCountRow] = await db
    .select({ value: count() })
    .from(shifts)
    .where(and(inArray(shifts.jobId, jobIds), checkedInStatusFilter, isNull(shifts.checkInConfirmedAt)));

  const checkedInRows = await db.query.shifts.findMany({
    where: and(inArray(shifts.jobId, jobIds), checkedInStatusFilter, isNull(shifts.checkInConfirmedAt)),
    orderBy: desc(shifts.checkInAt),
    limit: MAX_NOTIFICATIONS,
  });

  const [checkedOutCountRow] = await db
    .select({ value: count() })
    .from(shifts)
    .where(
      and(inArray(shifts.jobId, jobIds), eq(shifts.status, 'checked_out'), isNull(shifts.checkOutConfirmedAt)),
    );

  const checkedOutRows = await db.query.shifts.findMany({
    where: and(inArray(shifts.jobId, jobIds), eq(shifts.status, 'checked_out'), isNull(shifts.checkOutConfirmedAt)),
    orderBy: desc(shifts.checkOutAt),
    limit: MAX_NOTIFICATIONS,
  });

  const completedShiftRows = await db.query.shifts.findMany({
    where: and(inArray(shifts.jobId, jobIds), eq(shifts.status, 'completed')),
    orderBy: desc(shifts.checkOutAt),
  });
  const ratingsByShiftId = await getRatingsByShiftIds(completedShiftRows.map((row) => row.id));
  const unratedShiftRows = completedShiftRows.filter((row) => !ratingsByShiftId.get(row.id)?.company);
  const pendingRatingRows = unratedShiftRows.slice(0, MAX_NOTIFICATIONS);

  const workerIds = [
    ...new Set([
      ...pendingRows.map((row) => row.workerId),
      ...checkedInRows.map((row) => row.workerId),
      ...checkedOutRows.map((row) => row.workerId),
      ...pendingRatingRows.map((row) => row.workerId),
    ]),
  ];
  const workerRows =
    workerIds.length > 0 ? await db.query.workerProfiles.findMany({ where: inArray(workerProfiles.userId, workerIds) }) : [];
  const workersById = new Map(workerRows.map((worker) => [worker.userId, worker]));

  const categoryIds = [
    ...new Set(
      [...pendingRows, ...checkedInRows, ...checkedOutRows, ...pendingRatingRows].flatMap((row) => {
        const categoryId = jobsById.get(row.jobId)?.categoryId;
        return categoryId ? [categoryId] : [];
      }),
    ),
  ];
  const categoryRows =
    categoryIds.length > 0 ? await db.query.skillCategories.findMany({ where: inArray(skillCategories.id, categoryIds) }) : [];
  const categoriesById = new Map(categoryRows.map((category) => [category.id, category]));

  const pendingApplications = pendingRows.flatMap((row) => {
    const job = jobsById.get(row.jobId);
    const worker = workersById.get(row.workerId);
    const category = job ? categoriesById.get(job.categoryId) : undefined;
    if (!job || !worker || !category) {
      return [];
    }
    return [
      {
        applicationId: row.id,
        jobId: row.jobId,
        workerName: worker.fullName,
        categoryName: category.name,
        createdAt: row.createdAt,
      },
    ];
  });

  const checkedInNotifications = checkedInRows.flatMap((row) => {
    const job = jobsById.get(row.jobId);
    const worker = workersById.get(row.workerId);
    const category = job ? categoriesById.get(job.categoryId) : undefined;
    if (!job || !worker || !category || !row.checkInAt) {
      return [];
    }
    return [
      {
        shiftId: row.id,
        jobId: row.jobId,
        workerName: worker.fullName,
        categoryName: category.name,
        checkInAt: row.checkInAt,
      },
    ];
  });

  const checkedOutNotifications = checkedOutRows.flatMap((row) => {
    const job = jobsById.get(row.jobId);
    const worker = workersById.get(row.workerId);
    const category = job ? categoriesById.get(job.categoryId) : undefined;
    if (!job || !worker || !category || !row.checkOutAt) {
      return [];
    }
    return [
      {
        shiftId: row.id,
        jobId: row.jobId,
        workerName: worker.fullName,
        categoryName: category.name,
        checkOutAt: row.checkOutAt,
      },
    ];
  });

  const pendingRatingsNotifications = pendingRatingRows.flatMap((row) => {
    const job = jobsById.get(row.jobId);
    const worker = workersById.get(row.workerId);
    const category = job ? categoriesById.get(job.categoryId) : undefined;
    if (!job || !worker || !category || !row.checkOutAt) {
      return [];
    }
    return [
      {
        shiftId: row.id,
        jobId: row.jobId,
        workerName: worker.fullName,
        categoryName: category.name,
        checkOutAt: row.checkOutAt,
      },
    ];
  });

  return {
    pendingApplicationsCount: countRow?.value ?? 0,
    pendingApplications,
    checkedInCount: checkedInCountRow?.value ?? 0,
    checkedInNotifications,
    checkedOutCount: checkedOutCountRow?.value ?? 0,
    checkedOutNotifications,
    pendingRatingsCount: unratedShiftRows.length,
    pendingRatingsNotifications,
  };
}
