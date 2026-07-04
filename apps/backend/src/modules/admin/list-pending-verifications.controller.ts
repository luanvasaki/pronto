import { NextFunction, Request, Response } from 'express';
import { listPendingVerifications } from './list-pending-verifications';

export async function listPendingVerificationsHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await listPendingVerifications();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
