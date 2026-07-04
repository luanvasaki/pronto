import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { createRating } from './create-rating';

export async function createRatingHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const shiftId = req.params.id;
    if (typeof shiftId !== 'string') {
      throw new HttpError(404, 'Turno não encontrado.');
    }

    const { score, comment } = req.body as { score?: number; comment?: string };
    const result = await createRating(userId, shiftId, { score, comment });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
