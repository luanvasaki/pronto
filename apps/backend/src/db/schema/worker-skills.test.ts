import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../client';
import { skillCategories } from './skill-categories';
import { users } from './users';
import { workerProfiles } from './worker-profiles';
import { workerSkills } from './worker-skills';

// Fixtures únicas entre arquivos de teste (ver README).
const TEST_PHONE = '+5511977776000';
const TEST_CATEGORY_NAME = 'Categoria de teste — worker-skills';

async function createTestWorker() {
  const [user] = await db.insert(users).values({ phone: TEST_PHONE }).returning();
  const [profile] = await db
    .insert(workerProfiles)
    .values({ userId: user.id, fullName: 'Pedro Alves' })
    .returning();
  return profile;
}

describe('tabela worker_skills', () => {
  afterEach(async () => {
    // category_id não tem cascade (de propósito — ver schema). Apagar
    // o usuário primeiro cascade-deleta worker_skills, só depois a
    // categoria fica livre pra ser removida sem violar a FK.
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('associa um trabalhador a uma categoria', async () => {
    const profile = await createTestWorker();
    const [category] = await db
      .insert(skillCategories)
      .values({ name: TEST_CATEGORY_NAME })
      .returning();

    const [skill] = await db
      .insert(workerSkills)
      .values({ workerId: profile.userId, categoryId: category.id })
      .returning();

    expect(skill.workerId).toBe(profile.userId);
  });

  it('não permite associar a mesma categoria duas vezes', async () => {
    const profile = await createTestWorker();
    const [category] = await db
      .insert(skillCategories)
      .values({ name: TEST_CATEGORY_NAME })
      .returning();
    await db.insert(workerSkills).values({ workerId: profile.userId, categoryId: category.id });

    await expect(
      db.insert(workerSkills).values({ workerId: profile.userId, categoryId: category.id }),
    ).rejects.toThrow();
  });

  it('remove a associação junto quando o trabalhador é removido (cascade)', async () => {
    const profile = await createTestWorker();
    const [category] = await db
      .insert(skillCategories)
      .values({ name: TEST_CATEGORY_NAME })
      .returning();
    await db.insert(workerSkills).values({ workerId: profile.userId, categoryId: category.id });

    await db.delete(users).where(eq(users.phone, TEST_PHONE));

    const remaining = await db.query.workerSkills.findMany({
      where: eq(workerSkills.workerId, profile.userId),
    });
    expect(remaining).toHaveLength(0);
  });
});
