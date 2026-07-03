import { eq } from 'drizzle-orm';
import { Express } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { createApp } from '../../app';
import { otpCodeStore } from './otp-code-store';

async function loginAndGetTokens(
  app: Express,
  phone: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  await request(app).post('/auth/otp/request').send({ phone });
  const stored = await otpCodeStore.find(phone);
  const login = await request(app).post('/auth/otp/verify').send({ phone, code: stored?.code });
  return { accessToken: login.body.accessToken, refreshToken: login.body.refreshToken };
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

  it('cria a conta depois de pedir e validar o código certo', async () => {
    const app = createApp();

    await request(app).post('/auth/otp/request').send({ phone });
    const stored = await otpCodeStore.find(phone);

    const response = await request(app)
      .post('/auth/otp/verify')
      .send({ phone, code: stored?.code });

    expect(response.status).toBe(200);
    expect(response.body.isNewUser).toBe(true);
    expect(response.body.user.phone).toBe(phone);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));
  });

  it('responde 401 pra código errado', async () => {
    const app = createApp();
    await request(app).post('/auth/otp/request').send({ phone });

    const response = await request(app)
      .post('/auth/otp/verify')
      .send({ phone, code: '000000' });

    expect(response.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  const phone = '+5511988887003';

  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, phone));
  });

  it('responde 401 sem token', async () => {
    const app = createApp();

    const response = await request(app).get('/auth/me');

    expect(response.status).toBe(401);
  });

  it('responde 401 com token inválido', async () => {
    const app = createApp();

    const response = await request(app).get('/auth/me').set('Authorization', 'Bearer lixo');

    expect(response.status).toBe(401);
  });

  it('responde 200 com os dados do usuário logado', async () => {
    const app = createApp();
    await request(app).post('/auth/otp/request').send({ phone });
    const stored = await otpCodeStore.find(phone);
    const login = await request(app)
      .post('/auth/otp/verify')
      .send({ phone, code: stored?.code });

    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.user.phone).toBe(phone);
  });
});

describe('POST /auth/refresh', () => {
  const phone = '+5511988887004';

  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, phone));
  });

  it('responde 401 pra refresh token desconhecido', async () => {
    const app = createApp();

    const response = await request(app).post('/auth/refresh').send({ refreshToken: 'lixo' });

    expect(response.status).toBe(401);
  });

  it('emite um par novo de tokens e o antigo deixa de servir', async () => {
    const app = createApp();
    const { refreshToken } = await loginAndGetTokens(app, phone);

    const response = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(response.status).toBe(200);
    expect(response.body.refreshToken).not.toBe(refreshToken);

    const reuse = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(reuse.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  const phone = '+5511988887005';

  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, phone));
  });

  it('responde 200 e invalida o refresh token pra uso futuro', async () => {
    const app = createApp();
    const { refreshToken } = await loginAndGetTokens(app, phone);

    const logoutResponse = await request(app).post('/auth/logout').send({ refreshToken });
    expect(logoutResponse.status).toBe(200);

    const afterLogout = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(afterLogout.status).toBe(401);
  });

  it('responde 200 mesmo pra refresh token desconhecido', async () => {
    const app = createApp();

    const response = await request(app).post('/auth/logout').send({ refreshToken: 'lixo' });

    expect(response.status).toBe(200);
  });
});
