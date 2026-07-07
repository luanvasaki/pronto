import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { HttpError } from '../../shared/errors/http-error';
import { createFileStorage } from './file-storage';
import { uploadWorkerPhoto } from './upload-worker-photo';

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

/** Mesmo motivo do document upload: converte MulterError em HttpError. */
export function uploadWorkerPhotoMiddleware(req: Request, res: Response, next: NextFunction): void {
  upload.single('photo')(req, res, (error: unknown) => {
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

export async function uploadWorkerPhotoHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const result = await uploadWorkerPhoto(userId, req.file, fileStorage);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
