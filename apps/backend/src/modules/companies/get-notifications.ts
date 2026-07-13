import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';
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
 * Check-ins seguem o mesmo espírito, mas com "lido/não lido" de
 * verdade (`shifts.companySeenCheckInAt`) — diferente de uma
 * candidatura, o turno não muda de status sozinho quando a empresa
 * "resolve" o aviso, então precisa de um campo próprio + endpoint pra
 * marcar como visto (ver mark-shift-check-in-seen.ts).
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

  const [checkedInCountRow] = await db
    .select({ value: count() })
    .from(shifts)
    .where(
      and(inArray(shifts.jobId, jobIds), eq(shifts.status, 'checked_in'), isNull(shifts.companySeenCheckInAt)),
    );

  const checkedInRows = await db.query.shifts.findMany({
    where: and(inArray(shifts.jobId, jobIds), eq(shifts.status, 'checked_in'), isNull(shifts.companySeenCheckInAt)),
    orderBy: desc(shifts.checkInAt),
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
      ...pendingRatingRows.map((row) => row.workerId),
    ]),
  ];
  const workerRows =
    workerIds.length > 0 ? await db.query.workerProfiles.findMany({ where: inArray(workerProfiles.userId, workerIds) }) : [];
  const workersById = new Map(workerRows.map((worker) => [worker.userId, worker]));

  const categoryIds = [
    ...new Set(
      [...pendingRows, ...checkedInRows, ...pendingRatingRows].flatMap((row) => {
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
    pendingRatingsCount: unratedShiftRows.length,
    pendingRatingsNotifications,
  };
}
