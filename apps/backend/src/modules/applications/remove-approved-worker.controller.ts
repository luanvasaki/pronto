import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { removeApprovedWorker } from './remove-approved-worker';

export async function removeApprovedWorkerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const applicationId = req.params.id;
    if (typeof applicationId !== 'string') {
      throw new HttpError(404, 'Candidatura não encontrada.');
    }

    const result = await removeApprovedWorker(userId, applicationId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
