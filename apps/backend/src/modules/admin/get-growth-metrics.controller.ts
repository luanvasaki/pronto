import { NextFunction, Request, Response } from 'express';
import { getAdminGrowthMetrics } from './get-growth-metrics';

export async function getGrowthMetricsHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const metrics = await getAdminGrowthMetrics();
    res.status(200).json(metrics);
  } catch (error) {
    next(error);
  }
}
