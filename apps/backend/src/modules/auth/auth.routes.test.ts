import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';

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
