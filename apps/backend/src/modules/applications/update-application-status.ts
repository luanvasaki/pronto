import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { applications, companies, jobs } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { ApplicationResponse, toApplicationResponse } from './application-response';

type ApprovalStatus = 'approved' | 'rejected';

function isApprovalStatus(value: string): value is ApprovalStatus {
  return value === 'approved' || value === 'rejected';
}

/**
 * Aprovar incrementa positionsFilled e marca a vaga como "filled"
 * quando completa. Não desconta candidaturas concorrentes — no volume
 * do MVP (dono aprovando manualmente, um de cada vez) a leitura-depois-
 * escrita aqui é suficiente; revisar se isso virar um ponto de disputa.
 */
export async function updateApplicationStatus(
  ownerUserId: string,
  applicationId: string,
  status: string | undefined,
): Promise<ApplicationResponse> {
  if (!status || !isApprovalStatus(status)) {
    throw new HttpError(400, 'Status inválido — use "approved" ou "rejected".');
  }

  const application = await db.query.applications.findFirst({
    where: eq(applications.id, applicationId),
  });
  if (!application) {
    throw new HttpError(404, 'Candidatura não encontrada.');
  }
  if (application.status !== 'pending') {
    throw new HttpError(400, 'Essa candidatura já foi respondida.');
  }

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, application.jobId) });
  if (!job) {
    throw new HttpError(404, 'Vaga não encontrada.');
  }

  const company = await db.query.companies.findFirst({ where: eq(companies.id, job.companyId) });
  if (!company || company.ownerUserId !== ownerUserId) {
    throw new HttpError(403, 'Você não tem acesso a essa candidatura.');
  }

  const [updated] = await db
    .update(applications)
    .set({ status, updatedAt: new Date() })
    .where(eq(applications.id, applicationId))
    .returning();
  if (!updated) {
    throw new HttpError(500, 'Não foi possível atualizar a candidatura.');
  }

  if (status === 'approved') {
    const positionsFilled = job.positionsFilled + 1;
    await db
      .update(jobs)
      .set({
        positionsFilled,
        status: positionsFilled >= job.positionsTotal ? 'filled' : job.status,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, job.id));
  }

  return toApplicationResponse(updated);
}
