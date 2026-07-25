import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { EmailSender } from '../auth/email-sender';
import { reviewDocument } from './review-document';

export function createReviewDocumentHandler(sender: EmailSender) {
  return async function reviewDocumentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminUserId = req.auth?.userId;
      if (!adminUserId) {
        throw new HttpError(401, 'Sessão inválida ou expirada.');
      }

      const documentId = req.params.id;
      if (typeof documentId !== 'string') {
        throw new HttpError(404, 'Documento não encontrado.');
      }

      const { status, reason } = req.body as { status?: string; reason?: string };
      const result = await reviewDocument(adminUserId, documentId, status, sender, reason);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
