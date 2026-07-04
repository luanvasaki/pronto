import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { getCompanyProfile } from './get-company-profile';

export async function getCompanyProfileHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const result = await getCompanyProfile(userId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
