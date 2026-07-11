import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { upsertCompanyProfile } from './upsert-company-profile';

export async function upsertCompanyProfileHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const { legalName, tradeName, cnpj, addressLabel, businessSegment, businessSegmentOther } = req.body as {
      legalName?: string;
      tradeName?: string;
      cnpj?: string;
      addressLabel?: string;
      businessSegment?: string;
      businessSegmentOther?: string;
    };
    const result = await upsertCompanyProfile(userId, {
      legalName,
      tradeName,
      cnpj,
      addressLabel,
      businessSegment,
      businessSegmentOther,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
