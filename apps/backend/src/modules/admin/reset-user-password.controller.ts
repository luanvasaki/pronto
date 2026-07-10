import { NextFunction, Request, Response } from 'express';
import { resolveResetBaseUrl } from '../auth/forgot-password.controller';
import { EmailSender } from '../auth/email-sender';
import { HttpError } from '../../shared/errors/http-error';
import { resetUserPassword } from './reset-user-password';

export function createResetUserPasswordHandler(sender: EmailSender) {
  return async function resetUserPasswordHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.id;
      if (typeof userId !== 'string') {
        throw new HttpError(404, 'Usuário não encontrado.');
      }

      const resetBaseUrl = resolveResetBaseUrl(req);
      const result = await resetUserPassword(userId, sender, resetBaseUrl);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
