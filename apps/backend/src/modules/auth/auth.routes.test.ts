import { eq } from 'drizzle-orm';
import { Express } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { createApp } from '../../app';
import { otpCodeStore } from './otp-code-store';

type Agent = ReturnType<typeof request.agent>;

async function requestOtpCode(agent: Agent, phone: string): Promise<string> {
  await agent.post('/auth/otp/request').send({ phone });
  const stored = await otpCodeStore.find(phone);
  return stored?.code ?? '';
}

function extractSetCookie(headers: Record<string, unknown>, name: string): string {
  const raw = (headers['set-cookie'] ?? []) as string[];
  const found = raw.find((cookie) => cookie.startsWith(`${name}=`));
  if (!found) {
    throw new Error(`Cookie ${name} não encontrado na resposta.`);
  }
  return found.split(';')[0];
}

describe('POST /auth/otp/request', () => {
  it('responde 200 pra um celular válido', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/auth/otp/request')
      .send({ phone: '+5511988887000' });

    expect(response.status).toBe(200);
  });

  it('responde 400 pra celular inválido', async () => {
    const app = createApp();

    const response = await request(app).post('/auth/otp/request').send({ phone: 'abc' });

    expect(response.status).toBe(400);
  });

  it('responde 429 no segundo pedido pro mesmo celular', async () => {
    const app = createApp();
    const phone = '+5511988887001';

    await request(app).post('/auth/otp/request').send({ phone });
    const second = await request(app).post('/auth/otp/request').send({ phone });

    expect(second.status).toBe(429);
  });
});

describe('fluxo completo: pedir OTP e validar', () => {
  const phone = '+5511988887002';

  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, phone));
  });

  it('cria a conta e manda os cookies de sessão httpOnly', async () => {
    const app = createApp();
    const agent = request.agent(app);
    const code = await requestOtpCode(agent, phone);

    const response = await agent.post('/auth/otp/verify').send({ phone, code });

    expect(response.status).toBe(200);
    expect(response.body.isNewUser).toBe(true);
    expect(response.body.user.phone).toBe(phone);
    // Tokens nunca voltam no corpo — só em cookie httpOnly.
    expect(response.body.accessToken).toBeUndefined();
    // extractSetCookie corta pro "nome=valor" (pra poder reapresentar
    // como header Cookie depois) — o HttpOnly precisa do header cru.
    const rawCookies = response.headers['set-cookie'] as unknown as string[];
    expect(rawCookies.some((c) => c.startsWith('shift_access_token=') && c.includes('HttpOnly'))).toBe(
      true,
    );
    expect(rawCookies.some((c) => c.startsWith('shift_refresh_token=') && c.includes('HttpOnly'))).toBe(
      true,
    );
  });

  it('responde 401 pra código errado', async () => {
    const app = createApp();
    const agent = request.agent(app);
    await requestOtpCode(agent, phone);

    const response = await agent.post('/auth/otp/verify').send({ phone, code: '000000' });

    expect(response.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  const phone = '+5511988887003';

  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, phone));
  });

  it('responde 401 sem cookie de sessão', async () => {
    const app = createApp();

    const response = await request(app).get('/auth/me');

    expect(response.status).toBe(401);
  });

  it('responde 401 com cookie de token inválido', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/auth/me')
      .set('Cookie', 'shift_access_token=lixo');

    expect(response.status).toBe(401);
  });

  it('responde 200 com os dados do usuário logado (cookie levado automaticamente pelo agent)', async () => {
    const app: Express = createApp();
    const agent = request.agent(app);
    const code = await requestOtpCode(agent, phone);
    await agent.post('/auth/otp/verify').send({ phone, code });

    const response = await agent.get('/auth/me');

    expect(response.status).toBe(200);
    expect(response.body.user.phone).toBe(phone);
  });
});

describe('POST /auth/refresh', () => {
  const phone = '+5511988887004';

  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, phone));
  });

  it('responde 400 sem cookie de refresh', async () => {
    const app = createApp();

    const response = await request(app).post('/auth/refresh');

    expect(response.status).toBe(400);
  });

  it('emite cookies novos e o refresh antigo deixa de servir (reuso detectado)', async () => {
    const app = createApp();
    const agent = request.agent(app);
    const code = await requestOtpCode(agent, phone);
    const login = await agent.post('/auth/otp/verify').send({ phone, code });
    const oldRefreshCookie = extractSetCookie(login.headers, 'shift_refresh_token');

    const refreshed = await agent.post('/auth/refresh');
    expect(refreshed.status).toBe(200);

    // Reapresenta o cookie antigo (já girado) numa requisição separada,
    // simulando alguém com uma cópia antiga do token.
    const reuse = await request(app).post('/auth/refresh').set('Cookie', oldRefreshCookie);
    expect(reuse.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  const phone = '+5511988887005';

  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, phone));
  });

  it('invalida o cookie de refresh pra uso futuro', async () => {
    const app = createApp();
    const agent = request.agent(app);
    const code = await requestOtpCode(agent, phone);
    const login = await agent.post('/auth/otp/verify').send({ phone, code });
    const refreshCookie = extractSetCookie(login.headers, 'shift_refresh_token');

    const logoutResponse = await agent.post('/auth/logout');
    expect(logoutResponse.status).toBe(200);

    const afterLogout = await request(app).post('/auth/refresh').set('Cookie', refreshCookie);
    expect(afterLogout.status).toBe(401);
  });

  it('responde 200 mesmo sem cookie nenhum', async () => {
    const app = createApp();

    const response = await request(app).post('/auth/logout');

    expect(response.status).toBe(200);
  });
});
