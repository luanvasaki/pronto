import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { otpCodeStore } from '../auth/otp-code-store';

const TEST_PHONE = '+5511966660004';
const TEST_CNPJ = '11222333000183';

async function loginAgent(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post('/auth/otp/request').send({ phone: TEST_PHONE });
  const stored = await otpCodeStore.find(TEST_PHONE);
  await agent.post('/auth/otp/verify').send({ phone: TEST_PHONE, code: stored?.code });
  return agent;
}

describe('PUT /company-profile', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
  });

  it('responde 401 sem sessão', async () => {
    const app = createApp();

    const response = await request(app)
      .put('/company-profile')
      .send({ legalName: 'Bar Ltda', tradeName: 'Bar', cnpj: TEST_CNPJ });

    expect(response.status).toBe(401);
  });

  it('cria o perfil da empresa quando logado', async () => {
    const app = createApp();
    const agent = await loginAgent(app);

    const response = await agent
      .put('/company-profile')
      .send({ legalName: 'Bar do Zé Ltda', tradeName: 'Bar do Zé', cnpj: TEST_CNPJ });

    expect(response.status).toBe(200);
    expect(response.body.tradeName).toBe('Bar do Zé');
    expect(response.body.verificationStatus).toBe('pending');
  });
});

describe('GET /company-profile/me', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, TEST_PHONE));
  });

  it('responde 401 sem sessão', async () => {
    const app = createApp();

    const response = await request(app).get('/company-profile/me');

    expect(response.status).toBe(401);
  });

  it('retorna o perfil de quem já cadastrou a empresa', async () => {
    const app = createApp();
    const agent = await loginAgent(app);
    await agent.put('/company-profile').send({ legalName: 'Bar do Zé Ltda', tradeName: 'Bar do Zé', cnpj: TEST_CNPJ });

    const response = await agent.get('/company-profile/me');

    expect(response.status).toBe(200);
    expect(response.body.tradeName).toBe('Bar do Zé');
    expect(response.body.totalJobsPosted).toBe(0);
  });
});
