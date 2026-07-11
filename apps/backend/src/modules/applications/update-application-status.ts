import { and, eq, lt } from 'drizzle-orm';
import { db } from '../../db/client';
import { applications, companies, jobs, shifts } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { ApplicationResponse, toApplicationResponse } from './application-response';

type ApprovalStatus = 'approved' | 'rejected';

function isApprovalStatus(value: string): value is ApprovalStatus {
  return value === 'approved' || value === 'rejected';
}

/**
 * O UPDATE de status é condicional (WHERE status = 'pending') em vez
 * de checar-depois-escrever — fecha a mesma corrida encontrada em
 * create-application (duas chamadas simultâneas passando pela checagem
 * antes de qualquer uma escrever). Se `updated` vier vazio, é porque
 * outra chamada já respondeu essa candidatura entre a leitura e agora.
 *
 * Aprovar incrementa positionsFilled e marca a vaga como "filled"
 * quando completa, e cria o turno (shift) correspondente. A checagem
 * de vaga cheia acontece antes de qualquer escrita (evita aprovar
 * além de positionsTotal no caso comum, dono respondendo uma
 * candidatura de cada vez) e o UPDATE de positionsFilled também é
 * condicional (WHERE positions_filled < positions_total), pra fechar
 * a mesma corrida entre duas aprovações simultâneas.
 *
 * As três escritas da aprovação (status da candidatura, positionsFilled
 * da vaga, criação do turno) rodam numa transação — sem isso, se a
 * corrida acima realmente acontecesse, a candidatura ficava "approved"
 * sem turno correspondente e sem ter contado pra positionsFilled,
 * um estado que nada mais no sistema sabe corrigir depois.
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

  if (status === 'approved' && job.positionsFilled >= job.positionsTotal) {
    throw new HttpError(400, 'Essa vaga já está preenchida.');
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(applications)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(applications.id, applicationId), eq(applications.status, 'pending')))
      .returning();
    if (!updated) {
      throw new HttpError(400, 'Essa candidatura já foi respondida.');
    }

    if (status === 'approved') {
      const positionsFilled = job.positionsFilled + 1;
      const [updatedJob] = await tx
        .update(jobs)
        .set({
          positionsFilled,
          status: positionsFilled >= job.positionsTotal ? 'filled' : job.status,
          updatedAt: new Date(),
        })
        .where(and(eq(jobs.id, job.id), lt(jobs.positionsFilled, jobs.positionsTotal)))
        .returning();
      if (!updatedJob) {
        throw new HttpError(400, 'Essa vaga já está preenchida.');
      }

      const [shift] = await tx
        .insert(shifts)
        .values({
          applicationId: updated.id,
          jobId: job.id,
          workerId: updated.workerId,
          payAmountSnapshot: job.payAmount,
        })
        .returning();
      if (!shift) {
        throw new HttpError(500, 'Não foi possível criar o turno.');
      }
    }

    return toApplicationResponse(updated);
  });
}
