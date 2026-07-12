import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app';
import { db } from '../../db/client';

describe('GET /health', () => {
  it('responde 200 com status ok quando o banco responde', async () => {
    const app = createApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('responde 503 quando o banco não responde', async () => {
    const executeSpy = vi.spyOn(db, 'execute').mockRejectedValueOnce(new Error('conexão recusada'));
    const app = createApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('error');
    executeSpy.mockRestore();
  });

  it('responde 404 pra rota inexistente', async () => {
    const app = createApp();

    const response = await request(app).get('/rota-que-nao-existe');

    expect(response.status).toBe(404);
    expect(response.body.error).toContain('Rota não encontrada');
  });
});
