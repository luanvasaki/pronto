import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, skillCategories, workerProfiles } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { isUniqueViolation } from '../../shared/is-unique-violation';

export interface SkillCategoryResult {
  id: string;
  name: string;
}

/**
 * Empresa ou trabalhador cria uma categoria na hora de publicar/se
 * cadastrar, quando nenhuma das existentes serve — fica usável
 * imediatamente (status "pending" não bloqueia nada em
 * createJob/updateJob/upsertWorkerProfile, só marca pra fila do admin
 * em /admin). Se já existe uma categoria com esse nome (mesmo texto,
 * ignorando maiúsculas/acentuação de caixa), devolve ela em vez de
 * criar duplicata — quem digitar o mesmo nome depois reaproveita.
 */
export async function createSkillCategory(userId: string, name: string | undefined): Promise<SkillCategoryResult> {
  const trimmedName = name?.trim();
  if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 100) {
    throw new HttpError(400, 'Nome da categoria precisa ter entre 2 e 100 caracteres.');
  }

  const company = await db.query.companies.findFirst({ where: eq(companies.ownerUserId, userId) });
  const workerProfile = company
    ? null
    : await db.query.workerProfiles.findFirst({ where: eq(workerProfiles.userId, userId) });
  if (!company && !workerProfile) {
    throw new HttpError(400, 'Complete seu cadastro antes de criar uma categoria.');
  }

  const existing = await db.query.skillCategories.findFirst({
    where: sql`lower(${skillCategories.name}) = lower(${trimmedName})`,
  });
  if (existing) {
    return { id: existing.id, name: existing.name };
  }

  let category;
  try {
    [category] = await db
      .insert(skillCategories)
      .values({
        name: trimmedName,
        status: 'pending',
        createdByCompanyId: company?.id,
        createdByWorkerId: workerProfile?.userId,
      })
      .returning();
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Duas pessoas pedindo a mesma categoria nova ao mesmo tempo —
      // quem perdeu a corrida do índice único reaproveita a que a
      // primeira acabou de criar, mesmo espírito do `existing` acima.
      const raceWinner = await db.query.skillCategories.findFirst({
        where: sql`lower(${skillCategories.name}) = lower(${trimmedName})`,
      });
      if (raceWinner) {
        return { id: raceWinner.id, name: raceWinner.name };
      }
    }
    throw error;
  }
  if (!category) {
    throw new HttpError(500, 'Não foi possível criar a categoria.');
  }

  return { id: category.id, name: category.name };
}
