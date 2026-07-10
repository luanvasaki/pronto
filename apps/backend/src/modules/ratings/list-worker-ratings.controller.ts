import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { listWorkerRatings } from './list-worker-ratings';

export async function listWorkerRatingsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const ratings = await listWorkerRatings(userId);
    res.status(200).json({ ratings });
  } catch (error) {
    next(error);
  }
}
