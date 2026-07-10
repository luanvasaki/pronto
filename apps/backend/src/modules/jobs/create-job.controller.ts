import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { createJob } from './create-job';

export async function createJobHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const {
      categoryId,
      description,
      requiresExperience,
      dressCode,
      toolsRequired,
      addressLabel,
      locationLat,
      locationLng,
      positionsTotal,
      payAmount,
      startsAt,
      endsAt,
      applicationsCloseAt,
    } = req.body as {
      categoryId?: string;
      description?: string;
      requiresExperience?: boolean;
      dressCode?: string;
      toolsRequired?: string;
      addressLabel?: string;
      locationLat?: number;
      locationLng?: number;
      positionsTotal?: number;
      payAmount?: string;
      startsAt?: string;
      endsAt?: string;
      applicationsCloseAt?: string;
    };

    const result = await createJob(userId, {
      categoryId,
      description,
      requiresExperience,
      dressCode,
      toolsRequired,
      addressLabel,
      locationLat,
      locationLng,
      positionsTotal,
      payAmount,
      startsAt,
      endsAt,
      applicationsCloseAt,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
