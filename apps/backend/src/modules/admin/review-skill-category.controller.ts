import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { reviewSkillCategory } from './review-skill-category';

export async function reviewSkillCategoryHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminUserId = req.auth?.userId;
    if (!adminUserId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const categoryId = req.params.id;
    if (typeof categoryId !== 'string') {
      throw new HttpError(404, 'Categoria não encontrada.');
    }

    const { status, name } = req.body as { status?: string; name?: string };
    const result = await reviewSkillCategory(adminUserId, categoryId, status, name);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
