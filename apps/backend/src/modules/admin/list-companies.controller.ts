import { NextFunction, Request, Response } from 'express';
import { listAdminCompanies } from './list-companies';

export async function listCompaniesHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const companies = await listAdminCompanies();
    res.status(200).json({ companies });
  } catch (error) {
    next(error);
  }
}
