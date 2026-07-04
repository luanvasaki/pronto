import { eq } from 'drizzle-orm';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { db } from '../../db/client';
import { companies, skillCategories, users } from '../../db/schema';
import { otpCodeStore } from '../auth/otp-code-store';

const WORKER_PHONE = '+5511955550010';
const OWNER_PHONE = '+5511955550011';
const ADMIN_PHONE = '+5511955550012';
const TEST_CATEGORY_NAME = 'Categoria de teste — admin-routes';
const TEST_CNPJ = '11222333000300';

async function loginAgent(app: ReturnType<typeof createApp>, phone: string) {
  const agent = request.agent(app);
  await agent.post('/auth/otp/request').send({ phone });
  const stored = await otpCodeStore.find(phone);
  await agent.post('/auth/otp/verify').send({ phone, code: stored?.code });
  return agent;
}

async function makeAdmin(phone: string): Promise<void> {
  await db.update(users).set({ isAdmin: true }).where(eq(users.phone, phone));
}

describe('rotas de admin', () => {
  afterEach(async () => {
    const worker = await db.query.users.findFirst({ where: eq(users.phone, WORKER_PHONE) });
    await db.delete(users).where(eq(users.phone, WORKER_PHONE));
    await db.delete(users).where(eq(users.phone, OWNER_PHONE));
    await db.delete(users).where(eq(users.phone, ADMIN_PHONE));
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
    const agent = await loginAgent(app, WORKER_PHONE);

    const response = await agent.get('/admin/verifications');

    expect(response.status).toBe(403);
  });

  it('lista documento pendente e o admin consegue baixar o arquivo e aprovar', async () => {
    const app = createApp();
    const workerAgent = await loginAgent(app, WORKER_PHONE);
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await workerAgent.put('/worker-profile').send({ fullName: 'Rafael Lima', categoryIds: [category.id] });
    const uploadResponse = await workerAgent
      .post('/worker-profile/document')
      .attach('document', Buffer.from('conteúdo de uma foto'), {
        filename: 'rg.jpg',
        contentType: 'image/jpeg',
      });

    const adminAgent = await loginAgent(app, ADMIN_PHONE);
    await makeAdmin(ADMIN_PHONE);

    const listResponse = await adminAgent.get('/admin/verifications');
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.documents.some((doc: { id: string }) => doc.id === uploadResponse.body.id)).toBe(
      true,
    );

    const fileResponse = await adminAgent.get(`/admin/documents/${uploadResponse.body.id}/file`);
    expect(fileResponse.status).toBe(200);
    expect(fileResponse.body.toString()).toBe('conteúdo de uma foto');

    const reviewResponse = await adminAgent
      .patch(`/admin/documents/${uploadResponse.body.id}`)
      .send({ status: 'approved' });
    expect(reviewResponse.status).toBe(200);
    expect(reviewResponse.body.status).toBe('approved');
  });

  it('aprova a verificação de uma empresa', async () => {
    const app = createApp();
    const ownerAgent = await loginAgent(app, OWNER_PHONE);
    const companyResponse = await ownerAgent
      .put('/company-profile')
      .send({ legalName: 'Bar do Zé Ltda', tradeName: 'Bar do Zé', cnpj: TEST_CNPJ });

    const adminAgent = await loginAgent(app, ADMIN_PHONE);
    await makeAdmin(ADMIN_PHONE);

    const response = await adminAgent
      .patch(`/admin/companies/${companyResponse.body.id}/verification`)
      .send({ status: 'approved' });

    expect(response.status).toBe(200);
    expect(response.body.verificationStatus).toBe('approved');

    const company = await db.query.companies.findFirst({ where: eq(companies.cnpj, TEST_CNPJ) });
    expect(company?.verificationStatus).toBe('approved');
  });
});
