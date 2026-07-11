import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { db } from '../../db/client';
import { skillCategories } from '../../db/schema';

const TEST_CATEGORY_NAME = 'Categoria de teste — skill-categories-routes';
const TEST_PENDING_CATEGORY_NAME = 'Categoria de teste pendente — skill-categories-routes';

describe('GET /skill-categories', () => {
  afterEach(async () => {
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_PENDING_CATEGORY_NAME));
  });

  it('responde 200 com a lista de categorias, sem exigir sessão', async () => {
    const app = createApp();
    await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME });

    const response = await request(app).get('/skill-categories');

    expect(response.status).toBe(200);
    expect(response.body.categories).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: TEST_CATEGORY_NAME })]),
    );
  });

  it('não lista categoria criada por usuário ainda pendente de revisão do admin', async () => {
    const app = createApp();
    await db.insert(skillCategories).values({ name: TEST_PENDING_CATEGORY_NAME, status: 'pending' });

    const response = await request(app).get('/skill-categories');

    expect(response.status).toBe(200);
    expect(response.body.categories).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: TEST_PENDING_CATEGORY_NAME })]),
    );
  });
});
