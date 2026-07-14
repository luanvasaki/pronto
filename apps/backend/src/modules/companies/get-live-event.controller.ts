import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { getLiveEventStatus } from './get-live-event-status';

export async function getLiveEventStatusHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const { dayStart, dayEnd } = req.query as { dayStart?: string; dayEnd?: string };
    const parsedStart = dayStart ? new Date(dayStart) : undefined;
    const parsedEnd = dayEnd ? new Date(dayEnd) : undefined;
    if (!parsedStart || Number.isNaN(parsedStart.getTime())) {
      throw new HttpError(400, 'dayStart inválido.');
    }
    if (!parsedEnd || Number.isNaN(parsedEnd.getTime())) {
      throw new HttpError(400, 'dayEnd inválido.');
    }

    const result = await getLiveEventStatus(userId, parsedStart, parsedEnd);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
