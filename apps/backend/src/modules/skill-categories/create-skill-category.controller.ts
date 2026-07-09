import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { createSkillCategory } from './create-skill-category';

export async function createSkillCategoryHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const { name } = req.body as { name?: string };
    const result = await createSkillCategory(userId, name);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
