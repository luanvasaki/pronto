import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { documents, workerProfiles } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';

type ReviewStatus = 'approved' | 'rejected';

function isReviewStatus(value: string): value is ReviewStatus {
  return value === 'approved' || value === 'rejected';
}

export interface ReviewDocumentResult {
  id: string;
  status: string;
}

/**
 * UPDATE condicional (WHERE status = 'pending') fecha a corrida de
 * duas revisões simultâneas, mesmo padrão de update-application-status.
 * Aprovar/rejeitar o documento também atualiza worker_profiles.kyc_status
 * — são dois campos que representam a mesma decisão, sem isso o
 * documento fica revisado mas o perfil continua "pending" pra sempre.
 */
export async function reviewDocument(
  adminUserId: string,
  documentId: string,
  status: string | undefined,
): Promise<ReviewDocumentResult> {
  if (!status || !isReviewStatus(status)) {
    throw new HttpError(400, 'Status inválido — use "approved" ou "rejected".');
  }

  const document = await db.query.documents.findFirst({ where: eq(documents.id, documentId) });
  if (!document) {
    throw new HttpError(404, 'Documento não encontrado.');
  }
  if (document.status !== 'pending') {
    throw new HttpError(400, 'Esse documento já foi revisado.');
  }

  const [updated] = await db
    .update(documents)
    .set({ status, reviewedBy: adminUserId, reviewedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(documents.id, documentId), eq(documents.status, 'pending')))
    .returning();
  if (!updated) {
    throw new HttpError(400, 'Esse documento já foi revisado.');
  }

  await db
    .update(workerProfiles)
    .set({ kycStatus: status, updatedAt: new Date() })
    .where(eq(workerProfiles.userId, document.workerId));

  return { id: updated.id, status: updated.status };
}
