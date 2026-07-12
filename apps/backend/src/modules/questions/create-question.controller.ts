import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { createQuestion } from './create-question';

export async function createQuestionHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const jobId = req.params.jobId;
    if (typeof jobId !== 'string') {
      throw new HttpError(404, 'Vaga não encontrada.');
    }

    const { question } = req.body as { question?: string };
    const result = await createQuestion(userId, jobId, question);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
