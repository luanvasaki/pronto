import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, companyDocuments } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { FileStorage } from '../workers/file-storage';
import { detectDocumentMimeType } from '../workers/image-signature';
import { UploadedFile } from '../workers/upload-document';

export interface UploadCompanyDocumentResult {
  id: string;
}

/**
 * Só faz sentido pra empresa pessoa física (sem CNPJ pra respaldar) —
 * mas não bloqueia por `personType` aqui: quem decide se o documento é
 * obrigatório é o cliente (cadastro pessoa física exige antes de
 * enviar); o endpoint aceita de qualquer empresa, sem problema.
 */
export async function uploadCompanyDocument(
  ownerUserId: string,
  file: UploadedFile | undefined,
  storage: FileStorage,
): Promise<UploadCompanyDocumentResult> {
  if (!file) {
    throw new HttpError(400, 'Nenhum arquivo enviado.');
  }

  const company = await db.query.companies.findFirst({ where: eq(companies.ownerUserId, ownerUserId) });
  if (!company) {
    throw new HttpError(400, 'Complete o cadastro da empresa antes de enviar o documento.');
  }

  const detectedMimeType = detectDocumentMimeType(file.buffer);
  if (!detectedMimeType) {
    throw new HttpError(400, 'Arquivo não é uma imagem (JPEG/PNG) ou PDF válido.');
  }

  const key = await storage.save(file.buffer, company.id, detectedMimeType);

  const [document] = await db.insert(companyDocuments).values({ companyId: company.id, fileUrl: key }).returning();
  if (!document) {
    throw new HttpError(500, 'Falha ao registrar documento.');
  }

  // Reenviar depois de recusado volta a empresa pra fila de revisão —
  // sem isso, uma empresa rejeitada uma vez nunca mais aparece pro
  // admin revisar, mesmo corrigindo o documento (e agora, com
  // create-job.ts exigindo aprovação, ficaria travada pra sempre).
  if (company.verificationStatus === 'rejected') {
    await db
      .update(companies)
      .set({ verificationStatus: 'pending', rejectionReason: null, updatedAt: new Date() })
      .where(eq(companies.id, company.id));
  }

  return { id: document.id };
}
