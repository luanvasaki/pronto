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
 *
 * Trabalhador manda dois documentos (identidade + selfie, ver
 * upload-document.ts) — rejeitar qualquer um dos dois já reprova a
 * verificação; aprovar só marca o perfil como aprovado quando TODOS
 * os documentos dele já estiverem aprovados.
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

  const workerDocuments = await db.query.documents.findMany({ where: eq(documents.workerId, document.workerId) });
  const newKycStatus =
    status === 'rejected'
      ? 'rejected'
      : workerDocuments.every((workerDocument) => workerDocument.status === 'approved')
        ? 'approved'
        : 'pending';

  await db
    .update(workerProfiles)
    .set({ kycStatus: newKycStatus, updatedAt: new Date() })
    .where(eq(workerProfiles.userId, document.workerId));

  return { id: updated.id, status: updated.status };
}
