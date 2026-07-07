import { eq } from 'drizzle-orm';
import { Express } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { EmailSender } from './email-sender';
import { GoogleTokenVerifier, GoogleUserInfo } from './google-token-verifier';

type Agent = ReturnType<typeof request.agent>;

const TEST_PASSWORD = 'senha-de-teste-123';

class CapturingEmailSender implements EmailSender {
  public lastEmail?: string;
  public lastResetUrl?: string;

  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    this.lastEmail = email;
    this.lastResetUrl = resetUrl;
  }
}

class FakeGoogleTokenVerifier implements GoogleTokenVerifier {
  constructor(private readonly usersByToken: Record<string, GoogleUserInfo>) {}

  async verify(idToken: string): Promise<GoogleUserInfo> {
    const info = this.usersByToken[idToken];
    if (!info) {
      throw new Error('Token do Google desconhecido neste dublê de teste.');
    }
    return info;
  }
}

function extractSetCookie(headers: Record<string, unknown>, name: string): string {
  const raw = (headers['set-cookie'] ?? []) as string[];
  const found = raw.find((cookie) => cookie.startsWith(`${name}=`));
  if (!found) {
    throw new Error(`Cookie ${name} não encontrado na resposta.`);
  }
  return found.split(';')[0];
}

function extractTokenFromResetUrl(resetUrl: string): string {
  return new URL(resetUrl).searchParams.get('token') ?? '';
}

async function register(agent: Agent, email: string, password = TEST_PASSWORD) {
  return agent.post('/auth/register').send({ email, password, termsAccepted: true });
}

describe('POST /auth/register', () => {
  const email = 'register-flow@example.com';

  afterEach(async () => {
    await db.delete(users).where(eq(users.email, email));
  });

  it('cria a conta e manda os cookies de sessão httpOnly', async () => {
    const app = createApp();
    const agent = request.agent(app);

    const response = await register(agent, email);

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe(email);
    expect(response.body.accessToken).toBeUndefined();
    const rawCookies = response.headers['set-cookie'] as unknown as string[];
    expect(rawCookies.some((c) => c.startsWith('shift_access_token=') && c.includes('HttpOnly'))).toBe(true);
    expect(rawCookies.some((c) => c.startsWith('shift_refresh_token=') && c.includes('HttpOnly'))).toBe(true);
  });

  it('responde 400 pra email inválido', async () => {
    const app = createApp();
    const response = await request(app).post('/auth/register').send({ email: 'não-é-email', password: TEST_PASSWORD });

    expect(response.status).toBe(400);
  });

  it('responde 400 pra senha curta demais', async () => {
    const app = createApp();
    const response = await request(app).post('/auth/register').send({ email, password: '123' });

    expect(response.status).toBe(400);
  });

  it('responde 409 pra email já cadastrado', async () => {
    const app = createApp();
    await register(request.agent(app), email);

    const response = await request(app)
      .post('/auth/register')
      .send({ email, password: TEST_PASSWORD, termsAccepted: true });

    expect(response.status).toBe(409);
  });

  it('responde 400 sem aceitar os termos de uso', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/auth/register')
      .send({ email, password: TEST_PASSWORD, termsAccepted: false });

    expect(response.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  const email = 'login-flow@example.com';

  afterEach(async () => {
    await db.delete(users).where(eq(users.email, email));
  });

  it('responde 200 e seta cookies novos com a senha certa', async () => {
    const app = createApp();
    await register(request.agent(app), email);

    const response = await request(app).post('/auth/login').send({ email, password: TEST_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(email);
  });

  it('responde 401 com senha errada', async () => {
    const app = createApp();
    await register(request.agent(app), email);

    const response = await request(app).post('/auth/login').send({ email, password: 'senha-errada' });

    expect(response.status).toBe(401);
  });

  it('responde 401 pra email que não existe', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'nao-existe@example.com', password: TEST_PASSWORD });

    expect(response.status).toBe(401);
  });
});

describe('POST /auth/google', () => {
  const newAccountEmail = 'google-new-account@example.com';
  const existingGoogleEmail = 'google-existing-account@example.com';
  const conflictEmail = 'google-conflict@example.com';

  afterEach(async () => {
    await db.delete(users).where(eq(users.email, newAccountEmail));
    await db.delete(users).where(eq(users.email, existingGoogleEmail));
    await db.delete(users).where(eq(users.email, conflictEmail));
  });

  it('cria conta nova quando nem googleId nem email já existem', async () => {
    const verifier = new FakeGoogleTokenVerifier({
      'token-novo': { email: newAccountEmail, googleId: 'google-sub-novo', emailVerified: true },
    });
    const app = createApp({ authRoutes: { googleTokenVerifier: verifier } });

    const response = await request(app)
      .post('/auth/google')
      .send({ idToken: 'token-novo', termsAccepted: true });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(newAccountEmail);
  });

  it('responde 400 quando cria conta nova sem aceitar os termos de uso', async () => {
    const verifier = new FakeGoogleTokenVerifier({
      'token-sem-termos': { email: newAccountEmail, googleId: 'google-sub-sem-termos', emailVerified: true },
    });
    const app = createApp({ authRoutes: { googleTokenVerifier: verifier } });

    const response = await request(app).post('/auth/google').send({ idToken: 'token-sem-termos' });

    expect(response.status).toBe(400);
  });

  it('loga numa conta existente pelo googleId', async () => {
    const verifier = new FakeGoogleTokenVerifier({
      'token-existente': { email: existingGoogleEmail, googleId: 'google-sub-existente', emailVerified: true },
    });
    const app = createApp({ authRoutes: { googleTokenVerifier: verifier } });

    const first = await request(app)
      .post('/auth/google')
      .send({ idToken: 'token-existente', termsAccepted: true });
    const second = await request(app).post('/auth/google').send({ idToken: 'token-existente' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.user.id).toBe(first.body.user.id);
  });

  it('responde 409 quando o email já pertence a uma conta com senha (não linka automaticamente)', async () => {
    const app = createApp();
    await register(request.agent(app), conflictEmail);

    const verifier = new FakeGoogleTokenVerifier({
      'token-conflito': { email: conflictEmail, googleId: 'google-sub-conflito', emailVerified: true },
    });
    const appWithGoogle = createApp({ authRoutes: { googleTokenVerifier: verifier } });

    const response = await request(appWithGoogle).post('/auth/google').send({ idToken: 'token-conflito' });

    expect(response.status).toBe(409);
  });

  it('responde 401 (não 500) quando o token do Google é inválido/malformado', async () => {
    const verifier = new FakeGoogleTokenVerifier({});
    const app = createApp({ authRoutes: { googleTokenVerifier: verifier } });

    const response = await request(app).post('/auth/google').send({ idToken: 'token-invalido' });

    expect(response.status).toBe(401);
  });
});

describe('POST /auth/forgot-password + POST /auth/reset-password', () => {
  const email = 'reset-flow@example.com';

  afterEach(async () => {
    await db.delete(users).where(eq(users.email, email));
  });

  it('responde a mesma mensagem genérica pra email existente e inexistente', async () => {
    const app = createApp();
    await register(request.agent(app), email);

    const existing = await request(app).post('/auth/forgot-password').send({ email });
    const nonexistent = await request(app).post('/auth/forgot-password').send({ email: 'ninguem@example.com' });

    expect(existing.status).toBe(200);
    expect(nonexistent.status).toBe(200);
    expect(existing.body.message).toBe(nonexistent.body.message);
  });

  it('redefine a senha, derruba a sessão antiga, e o token não serve duas vezes', async () => {
    const sender = new CapturingEmailSender();
    const app = createApp({ authRoutes: { emailSender: sender } });
    const agent = request.agent(app);
    const registerResponse = await register(agent, email);
    const oldRefreshCookie = extractSetCookie(registerResponse.headers, 'shift_refresh_token');

    await request(app).post('/auth/forgot-password').send({ email }).set('Origin', 'http://localhost:3200');
    expect(sender.lastEmail).toBe(email);
    const token = extractTokenFromResetUrl(sender.lastResetUrl ?? '');
    expect(token).toBeTruthy();

    const resetResponse = await request(app)
      .post('/auth/reset-password')
      .send({ token, newPassword: 'senha-nova-123' });
    expect(resetResponse.status).toBe(200);

    // Sessão de antes do reset morre.
    const refreshAfterReset = await request(app).post('/auth/refresh').set('Cookie', oldRefreshCookie);
    expect(refreshAfterReset.status).toBe(401);

    // Senha antiga não serve mais, a nova serve.
    const loginOldPassword = await request(app).post('/auth/login').send({ email, password: TEST_PASSWORD });
    expect(loginOldPassword.status).toBe(401);
    const loginNewPassword = await request(app).post('/auth/login').send({ email, password: 'senha-nova-123' });
    expect(loginNewPassword.status).toBe(200);

    // Token de reset é de uso único.
    const reuseToken = await request(app)
      .post('/auth/reset-password')
      .send({ token, newPassword: 'outra-senha-123' });
    expect(reuseToken.status).toBe(401);
  });

  it('responde 401 pra token inválido', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'token-que-nao-existe', newPassword: 'senha-nova-123' });

    expect(response.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  const email = 'me-flow@example.com';

  afterEach(async () => {
    await db.delete(users).where(eq(users.email, email));
  });

  it('responde 401 sem cookie de sessão', async () => {
    const app = createApp();

    const response = await request(app).get('/auth/me');

    expect(response.status).toBe(401);
  });

  it('responde 401 com cookie de token inválido', async () => {
    const app = createApp();

    const response = await request(app).get('/auth/me').set('Cookie', 'shift_access_token=lixo');

    expect(response.status).toBe(401);
  });

  it('responde 200 com os dados do usuário logado (cookie levado automaticamente pelo agent)', async () => {
    const app: Express = createApp();
    const agent = request.agent(app);
    await register(agent, email);

    const response = await agent.get('/auth/me');

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(email);
  });
});

describe('POST /auth/refresh', () => {
  const email = 'refresh-flow@example.com';

  afterEach(async () => {
    await db.delete(users).where(eq(users.email, email));
  });

  it('responde 400 sem cookie de refresh', async () => {
    const app = createApp();

    const response = await request(app).post('/auth/refresh');

    expect(response.status).toBe(400);
  });

  it('emite cookies novos e o refresh antigo deixa de servir (reuso detectado)', async () => {
    const app = createApp();
    const agent = request.agent(app);
    const registerResponse = await register(agent, email);
    const oldRefreshCookie = extractSetCookie(registerResponse.headers, 'shift_refresh_token');

    const refreshed = await agent.post('/auth/refresh');
    expect(refreshed.status).toBe(200);

    // Reapresenta o cookie antigo (já girado) numa requisição separada,
    // simulando alguém com uma cópia antiga do token.
    const reuse = await request(app).post('/auth/refresh').set('Cookie', oldRefreshCookie);
    expect(reuse.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  const email = 'logout-flow@example.com';

  afterEach(async () => {
    await db.delete(users).where(eq(users.email, email));
  });

  it('invalida o cookie de refresh pra uso futuro', async () => {
    const app = createApp();
    const agent = request.agent(app);
    const registerResponse = await register(agent, email);
    const refreshCookie = extractSetCookie(registerResponse.headers, 'shift_refresh_token');

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
