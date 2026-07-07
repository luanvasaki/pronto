import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { workerProfiles } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { FileStorage } from './file-storage';
import { detectImageMimeType } from './image-signature';
import { UploadedFile } from './upload-document';

export interface UploadWorkerPhotoResult {
  photoUrl: string;
}

export async function uploadWorkerPhoto(
  userId: string,
  file: UploadedFile | undefined,
  storage: FileStorage,
): Promise<UploadWorkerPhotoResult> {
  if (!file) {
    throw new HttpError(400, 'Nenhum arquivo enviado.');
  }

  const profile = await db.query.workerProfiles.findFirst({
    where: eq(workerProfiles.userId, userId),
  });
  if (!profile) {
    throw new HttpError(400, 'Complete seu cadastro antes de enviar a foto de perfil.');
  }

  const detectedMimeType = detectImageMimeType(file.buffer);
  if (!detectedMimeType) {
    throw new HttpError(400, 'Arquivo não é uma imagem JPEG ou PNG válida.');
  }

  const photoUrl = await storage.save(file.buffer, userId, detectedMimeType, 'public');

  await db.update(workerProfiles).set({ photoUrl, updatedAt: new Date() }).where(eq(workerProfiles.userId, userId));

  return { photoUrl };
}
