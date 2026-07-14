import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { applications, companies, jobs, payments, shifts } from '../db/schema';

/**
 * Desfaz, na ordem certa, tudo que a empresa de um dono pode ter
 * criado num teste — pagamentos, turnos, candidaturas e vagas.
 * Nenhuma dessas tabelas tem `onDelete: cascade` a partir de
 * jobs/companies (de propósito, ver jobs.ts) — excluir o usuário dono
 * sem fazer essa limpeza primeiro derruba com violação de FK. Depois
 * de chamar isto, o usuário dono pode ser deletado normalmente
 * (users → companies já cascateia sozinho).
 *
 * Não é chamado automaticamente por nenhum teste existente — é um
 * helper pra reduzir a duplicação em testes NOVOS que hoje reimplementam
 * essa mesma cascata de 5-8 linhas por arquivo (ver README, seção
 * "Testando"). Migrar os testes existentes pra usar isso é um passo
 * separado, deliberadamente fora do escopo deste helper.
 */
export async function deleteCompanyJobsAndDependents(ownerUserId: string): Promise<void> {
  const company = await db.query.companies.findFirst({ where: eq(companies.ownerUserId, ownerUserId) });
  if (!company) return;

  const companyJobs = await db.query.jobs.findMany({ where: eq(jobs.companyId, company.id) });
  if (companyJobs.length === 0) {
    await db.delete(jobs).where(eq(jobs.companyId, company.id));
    return;
  }

  const jobIds = companyJobs.map((job) => job.id);
  const jobShifts = await db.query.shifts.findMany({ where: inArray(shifts.jobId, jobIds) });
  if (jobShifts.length > 0) {
    await db.delete(payments).where(
      inArray(
        payments.shiftId,
        jobShifts.map((shift) => shift.id),
      ),
    );
  }
  await db.delete(shifts).where(inArray(shifts.jobId, jobIds));
  await db.delete(applications).where(inArray(applications.jobId, jobIds));
  await db.delete(jobs).where(eq(jobs.companyId, company.id));
}
