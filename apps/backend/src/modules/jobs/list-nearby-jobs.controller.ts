import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { listNearbyJobs } from './list-nearby-jobs';

export async function listNearbyJobsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const jobs = await listNearbyJobs(userId);
    res.status(200).json({ jobs });
  } catch (error) {
    next(error);
  }
}
