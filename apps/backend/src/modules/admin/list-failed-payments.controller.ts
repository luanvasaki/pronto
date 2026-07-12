import { NextFunction, Request, Response } from 'express';
import { listFailedPayments } from './list-failed-payments';

export async function listFailedPaymentsHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payments = await listFailedPayments();
    res.status(200).json({ payments });
  } catch (error) {
    next(error);
  }
}
