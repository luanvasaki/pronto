import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { getJobDetailForWorker } from './get-job-detail';

export async function getJobDetailHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const jobId = req.params.id;
    if (typeof jobId !== 'string') {
      throw new HttpError(404, 'Vaga não encontrada.');
    }

    const result = await getJobDetailForWorker(userId, jobId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
