import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { listJobAnnouncements } from './list-job-announcements';

export async function listJobAnnouncementsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const jobId = req.params.jobId;
    if (typeof jobId !== 'string') {
      throw new HttpError(404, 'Vaga não encontrada.');
    }

    const announcements = await listJobAnnouncements(userId, jobId);
    res.json({ announcements });
  } catch (error) {
    next(error);
  }
}
