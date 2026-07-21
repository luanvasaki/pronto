import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { documents, workerProfiles } from '../../db/schema';
import { isMinor as checkIsMinor } from '../../shared/age';
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
 * verificação; aprovar só marca o perfil como aprovado quando o MAIS
 * RECENTE de cada tipo estiver aprovado.
 *
 * "Mais recente de cada tipo", não "todos os documentos já enviados":
 * upload-document.ts nunca atualiza uma linha existente, sempre insere
 * uma nova — reenviar um documento depois de rejeitado deixa a linha
 * antiga rejeitada no banco pra sempre. Considerar o histórico inteiro
 * faria um trabalhador rejeitado uma vez nunca mais conseguir chegar
 * a "approved", mesmo reenviando e sendo aprovado depois.
 */
export async function reviewDocument(
  adminUserId: string,
  documentId: string,
  status: string | undefined,
  reason?: string,
): Promise<ReviewDocumentResult> {
  if (!status || !isReviewStatus(status)) {
    throw new HttpError(400, 'Status inválido — use "approved" ou "rejected".');
  }
  if (status === 'rejected' && !reason?.trim()) {
    throw new HttpError(400, 'É preciso informar o motivo da rejeição.');
  }

  const document = await db.query.documents.findFirst({ where: eq(documents.id, documentId) });
  if (!document) {
    throw new HttpError(404, 'Documento não encontrado.');
  }
  if (document.status !== 'pending') {
    throw new HttpError(400, 'Esse documento já foi revisado.');
  }

  // As duas escritas (documento revisado + kyc_status do perfil) numa
  // transação só — são a mesma decisão em dois campos; sem isso, se a
  // segunda escrita falhasse, o documento ficaria revisado mas o
  // perfil continuaria "pending" pra sempre, sem nada no sistema
  // sabendo corrigir isso depois (mesmo raciocínio de cancel-job.ts).
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(documents)
      .set({
        status,
        rejectionReason: status === 'rejected' ? reason!.trim() : null,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(documents.id, documentId), eq(documents.status, 'pending')))
      .returning();
    if (!updated) {
      throw new HttpError(400, 'Esse documento já foi revisado.');
    }

    const workerProfile = await tx.query.workerProfiles.findFirst({
      where: eq(workerProfiles.userId, document.workerId),
    });
    const isMinor = checkIsMinor(workerProfile?.birthDate);

    const workerDocuments = await tx.query.documents.findMany({
      where: eq(documents.workerId, document.workerId),
      orderBy: desc(documents.createdAt),
    });
    const latestByType = new Map<string, (typeof workerDocuments)[number]>();
    for (const workerDocument of workerDocuments) {
      if (!latestByType.has(workerDocument.type)) {
        latestByType.set(workerDocument.type, workerDocument);
      }
    }
    const latestDocuments = [...latestByType.values()];
    // Trabalhador menor (16-17) precisa também do documento do
    // responsável aprovado E do registro de autorização em si
    // (guardianAuthorizedAt) — checar só o TIPO do documento enviado
    // não prova que os dados do responsável (nome/CPF/telefone) e a
    // autorização explícita existem; um perfil pode ter um documento
    // `guardian_identity` pendente de revisão sem nunca ter passado
    // pela validação de upsert-worker-profile.ts (ex.: dado corrompido,
    // chamada direta à API). Sem essa segunda checagem, "identity" +
    // "selfie" + "guardian_identity" aprovados já bastavam pra aprovar
    // o KYC de um menor mesmo sem consentimento registrado.
    const hasRequiredTypes =
      latestByType.has('identity') &&
      latestByType.has('selfie') &&
      (!isMinor || (latestByType.has('guardian_identity') && Boolean(workerProfile?.guardianAuthorizedAt)));
    const anyLatestRejected = latestDocuments.some((workerDocument) => workerDocument.status === 'rejected');
    const allLatestApproved =
      hasRequiredTypes && latestDocuments.every((workerDocument) => workerDocument.status === 'approved');

    const newKycStatus = anyLatestRejected ? 'rejected' : allLatestApproved ? 'approved' : 'pending';

    await tx
      .update(workerProfiles)
      .set({ kycStatus: newKycStatus, updatedAt: new Date() })
      .where(eq(workerProfiles.userId, document.workerId));

    return { id: updated.id, status: updated.status };
  });
}
