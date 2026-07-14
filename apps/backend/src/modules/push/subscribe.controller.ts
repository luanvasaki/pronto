import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { subscribeToPush } from './subscribe-to-push';

export async function subscribeToPushHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const { endpoint, keys } = req.body as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };

    const result = await subscribeToPush(userId, { endpoint, keys });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
