import { NextFunction, Request, Response } from 'express';
import { db } from '../../db/client';

/** Dado de referência público — sem requireAuth, não tem nada sensível aqui. */
export async function listSkillCategoriesHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const categories = await db.query.skillCategories.findMany({
      columns: { id: true, name: true },
    });
    res.status(200).json({ categories });
  } catch (error) {
    next(error);
  }
}
