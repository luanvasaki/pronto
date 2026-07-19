import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { skipRating } from './skip-rating';

export async function skipRatingHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const shiftId = req.params.id;
    if (typeof shiftId !== 'string') {
      throw new HttpError(404, 'Turno não encontrado.');
    }

    const result = await skipRating(userId, shiftId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
