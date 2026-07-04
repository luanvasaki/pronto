import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { updateApplicationStatus } from './update-application-status';

export async function updateApplicationStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const applicationId = req.params.id;
    if (typeof applicationId !== 'string') {
      throw new HttpError(404, 'Candidatura não encontrada.');
    }

    const { status } = req.body as { status?: string };
    const result = await updateApplicationStatus(userId, applicationId, status);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
