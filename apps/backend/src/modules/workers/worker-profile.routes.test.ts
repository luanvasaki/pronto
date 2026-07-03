import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { db } from '../../db/client';
import { skillCategories, users } from '../../db/schema';
import { otpCodeStore } from '../auth/otp-code-store';

const TEST_PHONE = '+5511966660002';
const TEST_CATEGORY_NAME = 'Categoria de teste — worker-profile-routes';

async function loginAgent(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post('/auth/otp/request').send({ phone: TEST_PHONE });
  const stored = await otpCodeStore.find(TEST_PHONE);
  await agent.post('/auth/otp/verify').send({ phone: TEST_PHONE, code: stored?.code });
  return agent;
}

describe('PUT /worker-profile', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('responde 401 sem sessão', async () => {
    const app = createApp();

    const response = await request(app).put('/worker-profile').send({ fullName: 'Ana' });

    expect(response.status).toBe(401);
  });

  it('cria o perfil quando logado', async () => {
    const app = createApp();
    const agent = await loginAgent(app);
    const [category] = await db
      .insert(skillCategories)
      .values({ name: TEST_CATEGORY_NAME })
      .returning();

    const response = await agent
      .put('/worker-profile')
      .send({ fullName: 'Ana Souza', categoryIds: [category.id] });

    expect(response.status).toBe(200);
    expect(response.body.fullName).toBe('Ana Souza');
  });
});
