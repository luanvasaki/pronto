import { NextFunction, Request, Response } from 'express';
import { listAdmins } from './list-admins';

export async function listAdminsHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const admins = await listAdmins();
    res.status(200).json({ admins });
  } catch (error) {
    next(error);
  }
}
