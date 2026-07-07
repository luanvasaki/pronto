import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { FileStorage } from '../workers/file-storage';
import { detectImageMimeType } from '../workers/image-signature';
import { UploadedFile } from '../workers/upload-document';

export interface UploadCompanyLogoResult {
  logoUrl: string;
}

export async function uploadCompanyLogo(
  ownerUserId: string,
  file: UploadedFile | undefined,
  storage: FileStorage,
): Promise<UploadCompanyLogoResult> {
  if (!file) {
    throw new HttpError(400, 'Nenhum arquivo enviado.');
  }

  const company = await db.query.companies.findFirst({ where: eq(companies.ownerUserId, ownerUserId) });
  if (!company) {
    throw new HttpError(400, 'Complete o cadastro da empresa antes de enviar o logo.');
  }

  const detectedMimeType = detectImageMimeType(file.buffer);
  if (!detectedMimeType) {
    throw new HttpError(400, 'Arquivo não é uma imagem JPEG ou PNG válida.');
  }

  const logoUrl = await storage.save(file.buffer, company.id, detectedMimeType, 'public');

  await db.update(companies).set({ logoUrl, updatedAt: new Date() }).where(eq(companies.ownerUserId, ownerUserId));

  return { logoUrl };
}
