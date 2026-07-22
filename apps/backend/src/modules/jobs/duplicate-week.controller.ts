import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { duplicateWeek } from './duplicate-week';

export async function duplicateWeekHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const { sourceWeekStart, targetWeekStart, termsAccepted, minorsTermsAccepted } = req.body as {
      sourceWeekStart?: string;
      targetWeekStart?: string;
      termsAccepted?: boolean;
      minorsTermsAccepted?: boolean;
    };

    const parsedSource = sourceWeekStart ? new Date(sourceWeekStart) : undefined;
    const parsedTarget = targetWeekStart ? new Date(targetWeekStart) : undefined;
    if (!parsedSource || Number.isNaN(parsedSource.getTime())) {
      throw new HttpError(400, 'Semana de origem inválida.');
    }
    if (!parsedTarget || Number.isNaN(parsedTarget.getTime())) {
      throw new HttpError(400, 'Semana de destino inválida.');
    }
    if (!termsAccepted) {
      throw new HttpError(400, 'É preciso confirmar que essas escalas são intermediação avulsa antes de duplicar.');
    }

    const result = await duplicateWeek(userId, {
      sourceWeekStart: parsedSource,
      targetWeekStart: parsedTarget,
      termsAccepted,
      minorsTermsAccepted,
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });
    res.status(201).json({ jobs: result });
  } catch (error) {
    next(error);
  }
}
