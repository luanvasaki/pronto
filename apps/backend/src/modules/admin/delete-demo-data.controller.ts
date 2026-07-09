import { NextFunction, Request, Response } from 'express';
import { deleteDemoData } from './demo-data';

export async function deleteDemoDataHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await deleteDemoData();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
