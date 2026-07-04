import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { createApplication } from './create-application';

export async function createApplicationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const jobId = req.params.jobId;
    if (typeof jobId !== 'string') {
      throw new HttpError(400, 'Vaga não encontrada.');
    }

    const result = await createApplication(userId, jobId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
