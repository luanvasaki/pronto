import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { cancelJob } from './cancel-job';

export async function cancelJobHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const jobId = req.params.id;
    if (typeof jobId !== 'string') {
      throw new HttpError(404, 'Vaga não encontrada.');
    }

    const result = await cancelJob(userId, jobId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
