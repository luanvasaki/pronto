import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { acceptLoginTerms } from './accept-login-terms';

export async function acceptLoginTermsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const { version } = req.body as { version?: string };
    const result = await acceptLoginTerms(userId, version, req.ip ?? null, req.get('user-agent') ?? null);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
