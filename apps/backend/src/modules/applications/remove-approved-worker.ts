import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { applications, companies, jobs, shifts } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { ApplicationResponse, toApplicationResponse } from './application-response';

/**
 * Desfaz uma aprovação (empresa clicou em "Aprovar" sem querer, por
 * exemplo). Só permitido enquanto o turno ainda não começou de
 * verdade (mesma trava de cancelJob) — depois de check-in ou
 * conclusão, isso já é um problema de turno em andamento, não uma
 * candidatura pra desfazer. Reabre a vaga (decrementa positionsFilled
 * e volta de 'filled' pra 'open' se for o caso) e cancela o shift
 * agendado. As três escritas rodam numa transação — sem isso, uma
 * falha no meio podia deixar a candidatura "rejected" sem reabrir a
 * vaga, travando a posição pra sempre.
 */
export async function removeApprovedWorker(ownerUserId: string, applicationId: string): Promise<ApplicationResponse> {
  const application = await db.query.applications.findFirst({ where: eq(applications.id, applicationId) });
  if (!application) {
    throw new HttpError(404, 'Candidatura não encontrada.');
  }

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, application.jobId) });
  if (!job) {
    throw new HttpError(404, 'Vaga não encontrada.');
  }

  const company = await db.query.companies.findFirst({ where: eq(companies.id, job.companyId) });
  if (!company || company.ownerUserId !== ownerUserId) {
    throw new HttpError(403, 'Você não tem acesso a essa candidatura.');
  }

  if (application.status !== 'approved') {
    throw new HttpError(400, 'Só é possível remover uma candidatura aprovada.');
  }

  const shift = await db.query.shifts.findFirst({ where: eq(shifts.applicationId, applicationId) });
  if (shift && (shift.status === 'checked_in' || shift.status === 'completed')) {
    throw new HttpError(400, 'Não é possível remover: o turno já começou ou foi concluído.');
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(applications)
      .set({ status: 'rejected', removedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(applications.id, applicationId), eq(applications.status, 'approved')))
      .returning();
    if (!updated) {
      throw new HttpError(400, 'Essa candidatura não está mais aprovada.');
    }

    if (shift && shift.status === 'scheduled') {
      await tx.update(shifts).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(shifts.id, shift.id));
    }

    const positionsFilled = Math.max(0, job.positionsFilled - 1);
    await tx
      .update(jobs)
      .set({
        positionsFilled,
        status: job.status === 'filled' ? 'open' : job.status,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, job.id));

    return toApplicationResponse(updated);
  });
}
