import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { documents, users, workerProfiles } from '../../db/schema';
import { EmailSender } from '../auth/email-sender';
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
  sender: EmailSender,
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
  const { result, notification } = await db.transaction(async (tx) => {
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
    const previousKycStatus = workerProfile?.kycStatus;

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

    const workerUser = await tx.query.users.findFirst({ where: eq(users.id, document.workerId) });

    return {
      result: { id: updated.id, status: updated.status },
      notification: {
        email: workerUser?.email ?? null,
        // Sempre que ESTA revisão rejeita — reflete a mesma decisão que já
        // aparece no app (documentRejectionReason). Aprovado só dispara na
        // TRANSIÇÃO de verdade pra approved, não a cada documento revisado
        // depois (ex.: reenvio de CNH após o KYC já estar aprovado não deve
        // reenviar o e-mail de "cadastro aprovado" de novo).
        rejectedReason: status === 'rejected' ? reason!.trim() : null,
        approvedTransition: previousKycStatus !== 'approved' && newKycStatus === 'approved',
      },
    };
  });

  // Fora da transação e sem propagar falha: a decisão de KYC já está
  // gravada e não pode ser desfeita ou bloqueada por uma instabilidade do
  // provedor de e-mail — o e-mail é só um aviso a mais, best-effort.
  if (notification.email) {
    try {
      if (notification.rejectedReason) {
        await sender.sendKycRejectedEmail(notification.email, notification.rejectedReason);
      } else if (notification.approvedTransition) {
        await sender.sendKycApprovedEmail(notification.email);
      }
    } catch (error) {
      console.error('[reviewDocument] Falha ao enviar e-mail de notificação de KYC:', error);
    }
  }

  return result;
}
