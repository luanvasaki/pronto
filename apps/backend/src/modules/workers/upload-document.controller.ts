import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { HttpError } from '../../shared/errors/http-error';
import { createFileStorage } from './file-storage';
import { uploadDocument } from './upload-document';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(new HttpError(400, 'Envie uma foto em JPEG ou PNG.'));
      return;
    }
    callback(null, true);
  },
});

const fileStorage = createFileStorage();

/**
 * Multer não integra sozinho com o errorHandler global — erro dele
 * (tipo/tamanho inválido) vira MulterError, não HttpError. Convertido
 * aqui pra manter o formato de erro consistente em toda a API.
 */
export function uploadDocumentMiddleware(req: Request, res: Response, next: NextFunction): void {
  upload.single('document')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(new HttpError(400, 'Arquivo inválido — verifique tipo (JPEG/PNG) e tamanho (até 5MB).'));
      return;
    }
    if (error) {
      next(error);
      return;
    }
    next();
  });
}

export async function uploadDocumentHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const result = await uploadDocument(userId, req.file, fileStorage);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
