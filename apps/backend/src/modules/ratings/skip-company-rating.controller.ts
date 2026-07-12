import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { skipCompanyRating } from './skip-company-rating';

export async function skipCompanyRatingHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const shiftId = req.params.id;
    if (typeof shiftId !== 'string') {
      throw new HttpError(404, 'Turno não encontrado.');
    }

    const result = await skipCompanyRating(userId, shiftId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
