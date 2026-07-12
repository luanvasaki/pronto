import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { answerQuestion } from './answer-question';

export async function answerQuestionHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const questionId = req.params.id;
    if (typeof questionId !== 'string') {
      throw new HttpError(404, 'Pergunta não encontrada.');
    }

    const { answer } = req.body as { answer?: string };
    const result = await answerQuestion(userId, questionId, answer);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
