import { NextFunction, Request, Response } from 'express';
import { listAdminWorkers } from './list-workers';

export async function listWorkersHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const workers = await listAdminWorkers();
    res.status(200).json({ workers });
  } catch (error) {
    next(error);
  }
}
