import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { reviewDocument } from './review-document';

export async function reviewDocumentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminUserId = req.auth?.userId;
    if (!adminUserId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const documentId = req.params.id;
    if (typeof documentId !== 'string') {
      throw new HttpError(404, 'Documento não encontrado.');
    }

    const { status } = req.body as { status?: string };
    const result = await reviewDocument(adminUserId, documentId, status);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
