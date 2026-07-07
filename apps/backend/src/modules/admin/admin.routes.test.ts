import { eq } from 'drizzle-orm';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { db } from '../../db/client';
import { companies, skillCategories, users } from '../../db/schema';

const WORKER_EMAIL = 'admin-routes-worker@example.com';
const OWNER_EMAIL = 'admin-routes-owner@example.com';
const ADMIN_EMAIL = 'admin-routes-admin@example.com';
const TEST_PASSWORD = 'senha-de-teste-123';
const TEST_CATEGORY_NAME = 'Categoria de teste — admin-routes';
const TEST_CNPJ = '11222333000300';

async function loginAgent(app: ReturnType<typeof createApp>, email: string) {
  const agent = request.agent(app);
  await agent.post('/auth/register').send({ email, password: TEST_PASSWORD, termsAccepted: true });
  return agent;
}

async function makeAdmin(email: string): Promise<void> {
  await db.update(users).set({ isAdmin: true }).where(eq(users.email, email));
}

describe('rotas de admin', () => {
  afterEach(async () => {
    const worker = await db.query.users.findFirst({ where: eq(users.email, WORKER_EMAIL) });
    await db.delete(users).where(eq(users.email, WORKER_EMAIL));
    await db.delete(users).where(eq(users.email, OWNER_EMAIL));
    await db.delete(users).where(eq(users.email, ADMIN_EMAIL));
    await db.delete(skillCategories).where(eq(skillCategories.name, TEST_CATEGORY_NAME));
    if (worker) {
      await rm(path.join(process.cwd(), 'uploads', 'documents', worker.id), {
        recursive: true,
        force: true,
      });
    }
  });

  it('GET /admin/verifications responde 401 sem sessão', async () => {
    const app = createApp();

    const response = await request(app).get('/admin/verifications');

    expect(response.status).toBe(401);
  });

  it('GET /admin/verifications responde 403 pra quem não é admin', async () => {
    const app = createApp();
    const agent = await loginAgent(app, WORKER_EMAIL);

    const response = await agent.get('/admin/verifications');

    expect(response.status).toBe(403);
  });

  it('GET /admin/metrics responde 401 sem sessão', async () => {
    const app = createApp();

    const response = await request(app).get('/admin/metrics');

    expect(response.status).toBe(401);
  });

  it('GET /admin/metrics responde 403 pra quem não é admin', async () => {
    const app = createApp();
    const agent = await loginAgent(app, WORKER_EMAIL);

    const response = await agent.get('/admin/metrics');

    expect(response.status).toBe(403);
  });

  it('GET /admin/metrics responde 200 com as métricas pro admin', async () => {
    const app = createApp();
    const adminAgent = await loginAgent(app, ADMIN_EMAIL);
    await makeAdmin(ADMIN_EMAIL);

    const response = await adminAgent.get('/admin/metrics');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('payments');
    expect(response.body).toHaveProperty('workers');
    expect(response.body).toHaveProperty('companies');
    expect(response.body).toHaveProperty('shifts');
  });

  it('lista documento pendente e o admin consegue baixar o arquivo e aprovar', async () => {
    const app = createApp();
    const workerAgent = await loginAgent(app, WORKER_EMAIL);
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await workerAgent.put('/worker-profile').send({ fullName: 'Rafael Lima', categoryIds: [category.id] });
    const documentBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const uploadResponse = await workerAgent
      .post('/worker-profile/document')
      .attach('document', documentBuffer, {
        filename: 'rg.jpg',
        contentType: 'image/jpeg',
      });

    const adminAgent = await loginAgent(app, ADMIN_EMAIL);
    await makeAdmin(ADMIN_EMAIL);

    const listResponse = await adminAgent.get('/admin/verifications');
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.documents.some((doc: { id: string }) => doc.id === uploadResponse.body.id)).toBe(
      true,
    );

    const fileResponse = await adminAgent.get(`/admin/documents/${uploadResponse.body.id}/file`);
    expect(fileResponse.status).toBe(200);
    expect(Buffer.compare(fileResponse.body, documentBuffer)).toBe(0);

    const reviewResponse = await adminAgent
      .patch(`/admin/documents/${uploadResponse.body.id}`)
      .send({ status: 'approved' });
    expect(reviewResponse.status).toBe(200);
    expect(reviewResponse.body.status).toBe('approved');
  });

  it('aprova a verificação de uma empresa', async () => {
    const app = createApp();
    const ownerAgent = await loginAgent(app, OWNER_EMAIL);
    const companyResponse = await ownerAgent
      .put('/company-profile')
      .send({ legalName: 'Bar do Zé Ltda', tradeName: 'Bar do Zé', cnpj: TEST_CNPJ });

    const adminAgent = await loginAgent(app, ADMIN_EMAIL);
    await makeAdmin(ADMIN_EMAIL);

    const response = await adminAgent
      .patch(`/admin/companies/${companyResponse.body.id}/verification`)
      .send({ status: 'approved' });

    expect(response.status).toBe(200);
    expect(response.body.verificationStatus).toBe('approved');

    const company = await db.query.companies.findFirst({ where: eq(companies.cnpj, TEST_CNPJ) });
    expect(company?.verificationStatus).toBe('approved');
  });
});
