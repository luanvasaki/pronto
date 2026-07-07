import { NextFunction, Request, Response } from 'express';
import { getAdminMetrics } from './get-metrics';

export async function getMetricsHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const metrics = await getAdminMetrics();
    res.status(200).json(metrics);
  } catch (error) {
    next(error);
  }
}
