import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { listMyShifts } from './list-my-shifts';

export async function listMyShiftsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const shifts = await listMyShifts(userId);
    res.status(200).json({ shifts });
  } catch (error) {
    next(error);
  }
}
