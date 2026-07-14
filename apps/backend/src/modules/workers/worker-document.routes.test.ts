import { eq } from 'drizzle-orm';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { db } from '../../db/client';
import { skillCategories, users } from '../../db/schema';

const TEST_EMAIL = 'worker-document-routes-test@example.com';
const TEST_PASSWORD = 'senha-de-teste-123';
const TEST_CATEGORY_NAME = 'Categoria de teste — worker-document-routes';
const TEST_CPF = '11122233710';
const TEST_ADDRESS = 'Rua das Flores, 123, Centro, São Paulo - SP';
const TEST_WORKER_PHONE = '11912345678';
const TEST_BIRTH_DATE = '2000-01-01';

async function loginAndCreateProfile(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post('/auth/register').send({ email: TEST_EMAIL, password: TEST_PASSWORD, termsAccepted: true });

  const [category] = await db
    .insert(skillCategories)
    .values({ name: TEST_CATEGORY_NAME })
    .returning();
  await agent.put('/worker-profile').send({
    fullName: 'Rafael Lima',
    categoryIds: [category.id],
    cpf: TEST_CPF,
    homeAddressFull: TEST_ADDRESS,
    phone: TEST_WORKER_PHONE,
    birthDate: TEST_BIRTH_DATE,
  });

  return agent;
}

describe('POST /worker-profile/document', () => {
  afterEach(async () => {
    const existing = await db.query.users.findFirst({ where: eq(users.email, TEST_EMAIL) });
    await db.delete(users).where(eq(users.email, TEST_EMAIL));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
    if (existing) {
      await rm(path.join(process.cwd(), 'uploads', 'documents', existing.id), {
        recursive: true,
        force: true,
      });
    }
  });

  it('responde 401 sem sessão', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/worker-profile/document')
      .attach('document', Buffer.from('foto'), { filename: 'rg.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(401);
  });

  it('responde 400 pra tipo de arquivo não permitido', async () => {
    const app = createApp();
    const agent = await loginAndCreateProfile(app);

    const response = await agent
      .post('/worker-profile/document')
      .attach('document', Buffer.from('não é imagem'), {
        filename: 'documento.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(400);
  });

  it('responde 400 quando o Content-Type diz imagem mas os bytes não são', async () => {
    const app = createApp();
    const agent = await loginAndCreateProfile(app);

    const response = await agent
      .post('/worker-profile/document')
      .attach('document', Buffer.from('isso não é uma imagem de verdade'), {
        filename: 'rg.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(400);
  });

  it('responde 201 e cria o documento com uma foto válida', async () => {
    const app = createApp();
    const agent = await loginAndCreateProfile(app);

    const response = await agent
      .post('/worker-profile/document')
      .attach('document', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), {
        filename: 'rg.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('pending');
    expect(response.body.type).toBe('identity');
  });

  it('responde 201 e grava como selfie quando o campo type é enviado', async () => {
    const app = createApp();
    const agent = await loginAndCreateProfile(app);

    const response = await agent
      .post('/worker-profile/document')
      .field('type', 'selfie')
      .attach('document', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), {
        filename: 'selfie.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(201);
    expect(response.body.type).toBe('selfie');
  });
});
