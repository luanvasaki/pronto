import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { updateWorkerSearchRadius } from './update-worker-search-radius';

export async function updateWorkerSearchRadiusHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const { searchRadiusKm } = req.body as { searchRadiusKm?: number };
    const result = await updateWorkerSearchRadius(userId, searchRadiusKm);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
