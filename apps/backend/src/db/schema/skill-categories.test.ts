import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../client';
import { skillCategories } from './skill-categories';

const TEST_NAME = 'Categoria de teste';

describe('tabela skill_categories', () => {
  afterEach(async () => {
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_NAME));
  });

  it('cria uma categoria', async () => {
    const [category] = await db
      .insert(skillCategories)
      .values({ name: TEST_NAME })
      .returning();

    expect(category.name).toBe(TEST_NAME);
  });

  it('não permite duas categorias com o mesmo nome', async () => {
    await db.insert(skillCategories).values({ name: TEST_NAME });

    await expect(db.insert(skillCategories).values({ name: TEST_NAME })).rejects.toThrow();
  });
});
