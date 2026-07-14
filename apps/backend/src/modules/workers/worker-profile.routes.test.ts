import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { db } from '../../db/client';
import { skillCategories, users } from '../../db/schema';

const TEST_EMAIL = 'worker-profile-routes-test@example.com';
const TEST_PASSWORD = 'senha-de-teste-123';
const TEST_CATEGORY_NAME = 'Categoria de teste — worker-profile-routes';
const TEST_CPF = '11122233809';
const TEST_ADDRESS = 'Rua das Flores, 123, Centro, São Paulo - SP';
const TEST_WORKER_PHONE = '11912345678';
const TEST_BIRTH_DATE = '2000-01-01';

async function loginAgent(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post('/auth/register').send({ email: TEST_EMAIL, password: TEST_PASSWORD, termsAccepted: true });
  return agent;
}

describe('PUT /worker-profile', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.email, TEST_EMAIL));
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
      .send({
        fullName: 'Ana Souza',
        categoryIds: [category.id],
        cpf: TEST_CPF,
        homeAddressFull: TEST_ADDRESS,
        phone: TEST_WORKER_PHONE,
        birthDate: TEST_BIRTH_DATE,
      });

    expect(response.status).toBe(200);
    expect(response.body.fullName).toBe('Ana Souza');
  });
});

describe('GET /worker-profile/me', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.email, TEST_EMAIL));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
  });

  it('responde 401 sem sessão', async () => {
    const app = createApp();

    const response = await request(app).get('/worker-profile/me');

    expect(response.status).toBe(401);
  });

  it('retorna o perfil de quem já se cadastrou', async () => {
    const app = createApp();
    const agent = await loginAgent(app);
    const [category] = await db
      .insert(skillCategories)
      .values({ name: TEST_CATEGORY_NAME })
      .returning();
    await agent
      .put('/worker-profile')
      .send({
        fullName: 'Ana Souza',
        categoryIds: [category.id],
        cpf: TEST_CPF,
        homeAddressFull: TEST_ADDRESS,
        phone: TEST_WORKER_PHONE,
        birthDate: TEST_BIRTH_DATE,
      });

    const response = await agent.get('/worker-profile/me');

    expect(response.status).toBe(200);
    expect(response.body.fullName).toBe('Ana Souza');
    expect(response.body.categoryIds).toEqual([category.id]);
  });
});
