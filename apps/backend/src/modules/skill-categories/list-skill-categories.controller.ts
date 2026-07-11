import { eq } from 'drizzle-orm';
import { NextFunction, Request, Response } from 'express';
import { db } from '../../db/client';
import { skillCategories } from '../../db/schema';

/**
 * Dado de referência público — sem requireAuth, não tem nada sensível
 * aqui. Só as aprovadas (categorias padrão já nascem 'approved'; uma
 * criada livremente por empresa/trabalhador nasce 'pending' e só
 * aparece pra todo mundo depois que um admin revisa — ver
 * create-skill-category.ts e review-skill-category.ts). Quem acabou
 * de criar a própria categoria continua usando ela normalmente
 * (o front injeta no estado local na hora, sem depender desse GET).
 */
export async function listSkillCategoriesHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const categories = await db.query.skillCategories.findMany({
      where: eq(skillCategories.status, 'approved'),
      columns: { id: true, name: true },
    });
    res.status(200).json({ categories });
  } catch (error) {
    next(error);
  }
}
