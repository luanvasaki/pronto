import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { documents, workerProfiles } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { FileStorage } from './file-storage';
import { detectDocumentMimeType } from './image-signature';

export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export interface UploadDocumentResult {
  id: string;
  status: string;
}

export async function uploadDocument(
  userId: string,
  file: UploadedFile | undefined,
  storage: FileStorage,
): Promise<UploadDocumentResult> {
  if (!file) {
    throw new HttpError(400, 'Nenhum arquivo enviado.');
  }

  const profile = await db.query.workerProfiles.findFirst({
    where: eq(workerProfiles.userId, userId),
  });
  if (!profile) {
    throw new HttpError(400, 'Complete seu cadastro antes de enviar o documento.');
  }

  const detectedMimeType = detectDocumentMimeType(file.buffer);
  if (!detectedMimeType) {
    throw new HttpError(400, 'Arquivo não é uma imagem (JPEG/PNG) ou PDF válido.');
  }

  const key = await storage.save(file.buffer, userId, detectedMimeType);

  const [document] = await db.insert(documents).values({ workerId: userId, fileUrl: key }).returning();

  if (!document) {
    throw new HttpError(500, 'Falha ao registrar documento.');
  }

  return { id: document.id, status: document.status };
}
