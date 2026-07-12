import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../errors/http-error';
import { requireSameOrigin } from './require-same-origin';

vi.mock('../../config/env', () => ({
  env: { corsOrigins: ['http://localhost:3000', 'http://localhost:3200'] },
}));

function fakeReq(method: string, origin?: string): { method: string; headers: Record<string, string> } {
  return { method, headers: origin ? { origin } : {} };
}

describe('requireSameOrigin', () => {
  it('deixa passar métodos que não escrevem (GET)', () => {
    const next = vi.fn();
    requireSameOrigin(fakeReq('GET', 'https://atacante.com') as never, {} as never, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('deixa passar escrita sem header Origin (curl, servidor-a-servidor)', () => {
    const next = vi.fn();
    requireSameOrigin(fakeReq('POST') as never, {} as never, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('deixa passar escrita com Origin permitida', () => {
    const next = vi.fn();
    requireSameOrigin(fakeReq('POST', 'http://localhost:3200') as never, {} as never, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejeita escrita com Origin de outro site (POST/PUT/PATCH/DELETE)', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const next = vi.fn();
      requireSameOrigin(fakeReq(method, 'https://atacante.com') as never, {} as never, next);
      expect(next).toHaveBeenCalledWith(expect.any(HttpError));
      expect((next.mock.calls[0][0] as HttpError).statusCode).toBe(403);
    }
  });
});
