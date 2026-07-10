import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { listCompanyRatings } from './list-company-ratings';

export async function listCompanyRatingsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const ratings = await listCompanyRatings(userId);
    res.status(200).json({ ratings });
  } catch (error) {
    next(error);
  }
}
