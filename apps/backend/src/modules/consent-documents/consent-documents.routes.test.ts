import request from 'supertest';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { db } from '../../db/client';
import { consentDocuments } from '../../db/schema';

const TEST_VERSION = 'test-route-0.1';

describe('GET /consent-documents/:type', () => {
  afterEach(async () => {
    await db.delete(consentDocuments).where(eq(consentDocuments.version, TEST_VERSION));
  });

  it('responde 404 pra um tipo que não existe', async () => {
    const app = createApp();

    const response = await request(app).get('/consent-documents/nao-existe');

    expect(response.status).toBe(404);
  });

  it('responde 200 com a versão mais recente, sem exigir autenticação', async () => {
    await db.insert(consentDocuments).values({
      type: 'login_summary',
      version: TEST_VERSION,
      chapters: [{ number: '1', heading: 'Teste', body: 'Corpo de teste.' }],
      declaration: 'Declaração de teste.',
    });
    const app = createApp();

    const response = await request(app).get('/consent-documents/login_summary');

    expect(response.status).toBe(200);
    expect(response.body.type).toBe('login_summary');
    expect(response.body.version).toBe(TEST_VERSION);
    expect(response.body.chapters).toEqual([{ number: '1', heading: 'Teste', body: 'Corpo de teste.' }]);
  });
});
