import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { getCompanyWorkerHistory } from './get-company-worker-history';

export async function getCompanyWorkerHistoryHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const workers = await getCompanyWorkerHistory(userId);
    res.status(200).json({ workers });
  } catch (error) {
    next(error);
  }
}
