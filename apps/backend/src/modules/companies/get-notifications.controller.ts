import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { getCompanyNotifications } from './get-notifications';

export async function getCompanyNotificationsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const result = await getCompanyNotifications(userId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
