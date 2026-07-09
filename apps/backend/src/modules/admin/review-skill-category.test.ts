import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { skillCategories } from '../../db/schema';
import { reviewSkillCategory } from './review-skill-category';

// Fixture única entre arquivos de teste (ver README).
const TEST_CATEGORY_NAME = 'Categoria pendente de teste';
const TEST_CATEGORY_NAME_FIXED = 'Categoria Pendente De Teste';

async function setupPendingCategory(name = TEST_CATEGORY_NAME) {
  const [category] = await db.insert(skillCategories).values({ name, status: 'pending' }).returning();
  return category;
}

describe('reviewSkillCategory', () => {
  afterEach(async () => {
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME_FIXED));
  });

  it('rejeita status inválido', async () => {
    const category = await setupPendingCategory();

    await expect(reviewSkillCategory(category.id, 'invalido', undefined)).rejects.toThrow('Status inválido');
  });

  it('rejeita categoria inexistente', async () => {
    await expect(
      reviewSkillCategory('00000000-0000-0000-0000-000000000000', 'approved', undefined),
    ).rejects.toThrow('não encontrada');
  });

  it('aprova a categoria sem alterar o nome', async () => {
    const category = await setupPendingCategory();

    const result = await reviewSkillCategory(category.id, 'approved', undefined);

    expect(result.status).toBe('approved');
    expect(result.name).toBe(TEST_CATEGORY_NAME);
  });

  it('aprova corrigindo o nome', async () => {
    const category = await setupPendingCategory();

    const result = await reviewSkillCategory(category.id, 'approved', TEST_CATEGORY_NAME_FIXED);

    expect(result.status).toBe('approved');
    expect(result.name).toBe(TEST_CATEGORY_NAME_FIXED);
  });

  it('rejeita a categoria', async () => {
    const category = await setupPendingCategory();

    const result = await reviewSkillCategory(category.id, 'rejected', undefined);

    expect(result.status).toBe('rejected');
  });

  it('rejeita revisar a mesma categoria duas vezes', async () => {
    const category = await setupPendingCategory();
    await reviewSkillCategory(category.id, 'approved', undefined);

    await expect(reviewSkillCategory(category.id, 'rejected', undefined)).rejects.toThrow('já foi revisada');
  });
});
