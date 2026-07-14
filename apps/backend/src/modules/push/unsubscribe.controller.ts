import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { unsubscribeFromPush } from './unsubscribe-from-push';

export async function unsubscribeFromPushHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const { endpoint } = req.body as { endpoint?: string };
    await unsubscribeFromPush(userId, endpoint);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
