import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { skillCategories } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';

type ReviewStatus = 'approved' | 'rejected';

function isReviewStatus(value: string): value is ReviewStatus {
  return value === 'approved' || value === 'rejected';
}

export interface ReviewSkillCategoryResult {
  id: string;
  name: string;
  status: string;
}

/**
 * Aprova (com ou sem correção do nome) ou rejeita. Categoria já pode
 * estar em uso por vagas publicadas — rejeitar só marca o status pro
 * admin, não apaga nem desfaz vaga nenhuma (a vaga continua com o
 * categoryId de qualquer jeito, é só sinalização). Corrigir o nome no
 * aprovar já reflete em qualquer vaga que use essa categoria, porque
 * `jobs.category_id` referencia por id, não por texto copiado.
 * UPDATE condicional (WHERE status = 'pending') fecha a corrida de
 * duas revisões simultâneas.
 */
export async function reviewSkillCategory(
  categoryId: string,
  status: string | undefined,
  name: string | undefined,
): Promise<ReviewSkillCategoryResult> {
  if (!status || !isReviewStatus(status)) {
    throw new HttpError(400, 'Status inválido — use "approved" ou "rejected".');
  }

  const category = await db.query.skillCategories.findFirst({ where: eq(skillCategories.id, categoryId) });
  if (!category) {
    throw new HttpError(404, 'Categoria não encontrada.');
  }
  if (category.status !== 'pending') {
    throw new HttpError(400, 'Essa categoria já foi revisada.');
  }

  const trimmedName = name?.trim();
  if (trimmedName !== undefined && (trimmedName.length < 2 || trimmedName.length > 100)) {
    throw new HttpError(400, 'Nome da categoria precisa ter entre 2 e 100 caracteres.');
  }

  const [updated] = await db
    .update(skillCategories)
    .set({ status, name: trimmedName || category.name, updatedAt: new Date() })
    .where(and(eq(skillCategories.id, categoryId), eq(skillCategories.status, 'pending')))
    .returning();
  if (!updated) {
    throw new HttpError(400, 'Essa categoria já foi revisada.');
  }

  return { id: updated.id, name: updated.name, status: updated.status };
}
