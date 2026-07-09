import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { updateJob } from './update-job';

export async function updateJobHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const jobId = req.params.id;
    if (typeof jobId !== 'string') {
      throw new HttpError(404, 'Vaga não encontrada.');
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
    };

    const result = await updateJob(userId, jobId, {
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
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
