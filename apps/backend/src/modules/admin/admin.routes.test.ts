import { eq } from 'drizzle-orm';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { db } from '../../db/client';
import { companies, skillCategories, users } from '../../db/schema';
import { EmailSender } from '../auth/email-sender';

class CapturingEmailSender implements EmailSender {
  public lastEmail?: string;
  public lastResetUrl?: string;

  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    this.lastEmail = email;
    this.lastResetUrl = resetUrl;
  }
}

const WORKER_EMAIL = 'admin-routes-worker@example.com';
const OWNER_EMAIL = 'admin-routes-owner@example.com';
const ADMIN_EMAIL = 'admin-routes-admin@example.com';
const TEST_PASSWORD = 'senha-de-teste-123';
const TEST_CATEGORY_NAME = 'Categoria de teste — admin-routes';
const TEST_CNPJ = '11222333003016';
const TEST_CPF = '11122233477';
const TEST_ADDRESS = 'Rua das Flores, 123, Centro, São Paulo - SP';
const TEST_WORKER_PHONE = '11912345678';
const TEST_BIRTH_DATE = '2000-01-01';

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

  it('GET /admin/growth-metrics responde 401 sem sessão', async () => {
    const app = createApp();

    const response = await request(app).get('/admin/growth-metrics');

    expect(response.status).toBe(401);
  });

  it('GET /admin/growth-metrics responde 403 pra quem não é admin', async () => {
    const app = createApp();
    const agent = await loginAgent(app, WORKER_EMAIL);

    const response = await agent.get('/admin/growth-metrics');

    expect(response.status).toBe(403);
  });

  it('GET /admin/growth-metrics responde 200 com as séries semanais pro admin', async () => {
    const app = createApp();
    const adminAgent = await loginAgent(app, ADMIN_EMAIL);
    await makeAdmin(ADMIN_EMAIL);

    const response = await adminAgent.get('/admin/growth-metrics');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('companies');
    expect(response.body).toHaveProperty('workers');
    expect(response.body).toHaveProperty('dealsClosed');
    expect(response.body.companies).toHaveLength(8);
  });

  it('lista documento pendente e o admin consegue baixar o arquivo e aprovar', async () => {
    const app = createApp();
    const workerAgent = await loginAgent(app, WORKER_EMAIL);
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await workerAgent
      .put('/worker-profile')
      .send({
        fullName: 'Rafael Lima',
        categoryIds: [category.id],
        cpf: TEST_CPF,
        homeAddressFull: TEST_ADDRESS,
        phone: TEST_WORKER_PHONE,
        birthDate: TEST_BIRTH_DATE,
      });
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
    const adminMeResponse = await adminAgent.get('/auth/me');

    const response = await adminAgent
      .patch(`/admin/companies/${companyResponse.body.id}/verification`)
      .send({ status: 'approved' });

    expect(response.status).toBe(200);
    expect(response.body.verificationStatus).toBe('approved');

    const company = await db.query.companies.findFirst({ where: eq(companies.cnpj, TEST_CNPJ) });
    expect(company?.verificationStatus).toBe('approved');
    expect(company?.reviewedBy).toBe(adminMeResponse.body.user.id);
    expect(company?.reviewedAt).toBeInstanceOf(Date);
  });

  it('GET /admin/companies responde 403 pra quem não é admin', async () => {
    const app = createApp();
    const agent = await loginAgent(app, WORKER_EMAIL);

    const response = await agent.get('/admin/companies');

    expect(response.status).toBe(403);
  });

  it('GET /admin/companies lista a empresa com métricas pro admin', async () => {
    const app = createApp();
    const ownerAgent = await loginAgent(app, OWNER_EMAIL);
    const companyResponse = await ownerAgent
      .put('/company-profile')
      .send({ legalName: 'Bar do Zé Ltda', tradeName: 'Bar do Zé', cnpj: TEST_CNPJ });

    const adminAgent = await loginAgent(app, ADMIN_EMAIL);
    await makeAdmin(ADMIN_EMAIL);

    const response = await adminAgent.get('/admin/companies');

    expect(response.status).toBe(200);
    const found = response.body.companies.find((company: { id: string }) => company.id === companyResponse.body.id);
    expect(found).toBeDefined();
    expect(found.ownerEmail).toBe(OWNER_EMAIL);
  });

  it('GET /admin/workers responde 403 pra quem não é admin', async () => {
    const app = createApp();
    const agent = await loginAgent(app, WORKER_EMAIL);

    const response = await agent.get('/admin/workers');

    expect(response.status).toBe(403);
  });

  it('GET /admin/workers lista o trabalhador com métricas pro admin', async () => {
    const app = createApp();
    const workerAgent = await loginAgent(app, WORKER_EMAIL);
    const [category] = await db.insert(skillCategories).values({ name: TEST_CATEGORY_NAME }).returning();
    await workerAgent
      .put('/worker-profile')
      .send({
        fullName: 'Rafael Lima',
        categoryIds: [category.id],
        cpf: TEST_CPF,
        homeAddressFull: TEST_ADDRESS,
        phone: TEST_WORKER_PHONE,
        birthDate: TEST_BIRTH_DATE,
      });
    const meResponse = await workerAgent.get('/auth/me');

    const adminAgent = await loginAgent(app, ADMIN_EMAIL);
    await makeAdmin(ADMIN_EMAIL);

    const response = await adminAgent.get('/admin/workers');

    expect(response.status).toBe(200);
    const found = response.body.workers.find((worker: { userId: string }) => worker.userId === meResponse.body.user.id);
    expect(found).toBeDefined();
    expect(found.email).toBe(WORKER_EMAIL);
  });

  it('POST /admin/users/:id/reset-password responde 403 pra quem não é admin', async () => {
    const sender = new CapturingEmailSender();
    const app = createApp({ adminRoutes: { emailSender: sender } });
    const agent = await loginAgent(app, WORKER_EMAIL);

    const response = await agent.post('/admin/users/00000000-0000-0000-0000-000000000000/reset-password');

    expect(response.status).toBe(403);
  });

  it('POST /admin/users/:id/reset-password dispara o e-mail de redefinição pro admin', async () => {
    const sender = new CapturingEmailSender();
    const app = createApp({ adminRoutes: { emailSender: sender } });
    const workerAgent = await loginAgent(app, WORKER_EMAIL);
    const meResponse = await workerAgent.get('/auth/me');

    const adminAgent = await loginAgent(app, ADMIN_EMAIL);
    await makeAdmin(ADMIN_EMAIL);

    const response = await adminAgent.post(`/admin/users/${meResponse.body.user.id}/reset-password`);

    expect(response.status).toBe(200);
    expect(response.body.email).toBe(WORKER_EMAIL);
    expect(sender.lastEmail).toBe(WORKER_EMAIL);
    expect(sender.lastResetUrl).toContain('/redefinir-senha?token=');
  });
});
