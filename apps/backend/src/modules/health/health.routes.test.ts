import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';

describe('GET /health', () => {
  it('responde 200 com status ok', async () => {
    const app = createApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('responde 404 pra rota inexistente', async () => {
    const app = createApp();

    const response = await request(app).get('/rota-que-nao-existe');

    expect(response.status).toBe(404);
    expect(response.body.error).toContain('Rota não encontrada');
  });
});
