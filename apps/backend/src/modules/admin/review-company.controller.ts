import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { reviewCompany } from './review-company';

export async function reviewCompanyHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminUserId = req.auth?.userId;
    if (!adminUserId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const companyId = req.params.id;
    if (typeof companyId !== 'string') {
      throw new HttpError(404, 'Empresa não encontrada.');
    }

    const { status } = req.body as { status?: string };
    const result = await reviewCompany(adminUserId, companyId, status);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
