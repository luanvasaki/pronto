import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { updateWorkerLocation } from './update-worker-location';

export async function updateWorkerLocationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const { lat, lng } = req.body as { lat?: number; lng?: number };
    const result = await updateWorkerLocation(userId, { lat, lng });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
