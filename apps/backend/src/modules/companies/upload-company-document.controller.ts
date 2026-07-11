import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { HttpError } from '../../shared/errors/http-error';
import { createFileStorage } from '../workers/file-storage';
import { uploadCompanyDocument } from './upload-company-document';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(new HttpError(400, 'Envie uma foto (JPEG/PNG) ou PDF.'));
      return;
    }
    callback(null, true);
  },
});

const fileStorage = createFileStorage('private');

/** Mesmo motivo do document/photo upload do trabalhador: converte MulterError em HttpError. */
export function uploadCompanyDocumentMiddleware(req: Request, res: Response, next: NextFunction): void {
  upload.single('document')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(new HttpError(400, 'Arquivo inválido — verifique tipo (JPEG/PNG/PDF) e tamanho (até 5MB).'));
      return;
    }
    if (error) {
      next(error);
      return;
    }
    next();
  });
}

export async function uploadCompanyDocumentHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const result = await uploadCompanyDocument(userId, req.file, fileStorage);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
