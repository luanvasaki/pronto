import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { upsertWorkerProfile } from './upsert-worker-profile';

export async function upsertWorkerProfileHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const { fullName, categoryIds } = req.body as {
      fullName?: string;
      categoryIds?: string[];
    };
    const result = await upsertWorkerProfile(userId, { fullName, categoryIds });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
