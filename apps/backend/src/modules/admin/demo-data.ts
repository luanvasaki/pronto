import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { applications, companies, jobs, payments, ratings, shifts, users } from '../../db/schema';

export interface DeleteDemoDataResult {
  companiesRemoved: number;
}

/**
 * Remove tudo que foi criado só pra popular o app com exemplos
 * (empresas com `isDemo: true`, suas vagas, candidaturas, turnos,
 * pagamentos e avaliações, e a conta dona de cada empresa). Nenhuma
 * FK dessa cadeia tem `onDelete: cascade` de propósito (ver comentário
 * em jobs.ts), então a ordem de exclusão importa: de baixo pra cima.
 */
export async function deleteDemoData(): Promise<DeleteDemoDataResult> {
  const demoCompanies = await db.query.companies.findMany({ where: eq(companies.isDemo, true) });
  if (demoCompanies.length === 0) {
    return { companiesRemoved: 0 };
  }

  const companyIds = demoCompanies.map((company) => company.id);
  const demoJobs = await db.query.jobs.findMany({ where: inArray(jobs.companyId, companyIds) });
  const jobIds = demoJobs.map((job) => job.id);

  const demoApplications = jobIds.length
    ? await db.query.applications.findMany({ where: inArray(applications.jobId, jobIds) })
    : [];
  const applicationIds = demoApplications.map((application) => application.id);

  const demoShifts = applicationIds.length
    ? await db.query.shifts.findMany({ where: inArray(shifts.applicationId, applicationIds) })
    : [];
  const shiftIds = demoShifts.map((shift) => shift.id);

  if (shiftIds.length) {
    await db.delete(ratings).where(inArray(ratings.shiftId, shiftIds));
    await db.delete(payments).where(inArray(payments.shiftId, shiftIds));
    await db.delete(shifts).where(inArray(shifts.id, shiftIds));
  }
  if (applicationIds.length) {
    await db.delete(applications).where(inArray(applications.id, applicationIds));
  }
  if (jobIds.length) {
    await db.delete(jobs).where(inArray(jobs.id, jobIds));
  }

  const ownerUserIds = demoCompanies.map((company) => company.ownerUserId);
  // Apaga o usuário dono — companies tem onDelete: cascade em
  // owner_user_id, então a empresa some junto, sem precisar de um
  // delete explícito nela.
  await db.delete(users).where(inArray(users.id, ownerUserIds));

  return { companiesRemoved: demoCompanies.length };
}
