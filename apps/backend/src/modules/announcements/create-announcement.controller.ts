import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { createAnnouncement } from './create-announcement';

export async function createAnnouncementHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const jobId = req.params.jobId;
    if (typeof jobId !== 'string') {
      throw new HttpError(404, 'Vaga não encontrada.');
    }

    const { message } = req.body as { message?: string };
    const result = await createAnnouncement(userId, jobId, message);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
