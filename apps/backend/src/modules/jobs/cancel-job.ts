import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { applications, companies, jobs, shifts } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { JobResponse, toJobResponse } from './job-response';

/**
 * Só cancela enquanto nenhum turno da vaga começou de verdade — se
 * já tem check-in ou turno concluído, tem trabalho (e possivelmente
 * pagamento) em andamento, e cancelar a vaga inteira não é a ação
 * certa nesse ponto (isso vira um problema por turno, não por vaga).
 * Ao cancelar: rejeita as candidaturas ainda pendentes (não faz
 * sentido elas continuarem "em análise" pra uma vaga cancelada) e
 * cancela os turnos que ainda estavam "scheduled". As quatro escritas
 * rodam numa transação — sem isso, uma falha no meio podia deixar a
 * vaga "cancelled" com candidaturas/turnos que ainda pareciam ativos.
 */
export async function cancelJob(ownerUserId: string, jobId: string): Promise<JobResponse> {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
  if (!job) {
    throw new HttpError(404, 'Vaga não encontrada.');
  }

  const company = await db.query.companies.findFirst({ where: eq(companies.id, job.companyId) });
  if (!company || company.ownerUserId !== ownerUserId) {
    throw new HttpError(403, 'Você não tem acesso a essa vaga.');
  }

  if (job.status === 'cancelled') {
    throw new HttpError(400, 'Essa vaga já está cancelada.');
  }

  const jobShifts = await db.query.shifts.findMany({ where: eq(shifts.jobId, jobId) });
  const hasShiftInProgress = jobShifts.some(
    (shift) => shift.status === 'checked_in' || shift.status === 'completed',
  );
  if (hasShiftInProgress) {
    throw new HttpError(400, 'Não é possível cancelar: já existe turno em andamento ou concluído nessa vaga.');
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(jobs)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(eq(jobs.id, jobId), eq(jobs.status, job.status)))
      .returning();
    if (!updated) {
      throw new HttpError(400, 'Essa vaga já está cancelada.');
    }

    await tx
      .update(applications)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(and(eq(applications.jobId, jobId), eq(applications.status, 'pending')));

    // Candidatura aprovada tem turno 'scheduled' associado (garantido pelo
    // hasShiftInProgress acima) — cancelar a vaga tira o trabalhador dela
    // igual a removeApprovedWorker, com removedAt pra ele ver o aviso.
    await tx
      .update(applications)
      .set({ status: 'rejected', removedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(applications.jobId, jobId), eq(applications.status, 'approved')));

    const scheduledShiftIds = jobShifts
      .filter((shift) => shift.status === 'scheduled')
      .map((shift) => shift.id);
    if (scheduledShiftIds.length > 0) {
      await tx
        .update(shifts)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(inArray(shifts.id, scheduledShiftIds));
    }

    return toJobResponse(updated);
  });
}
