import { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { requireAuth } from './require-auth';
import { signAccessToken } from './jwt';

function fakeResponse(): Response {
  return {} as Response;
}

describe('requireAuth', () => {
  it('rejeita quando não há header de autorização', () => {
    const req = { headers: {} } as Request;
    const next = vi.fn();

    requireAuth(req, fakeResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('rejeita header sem prefixo Bearer', () => {
    const req = { headers: { authorization: 'Token abc123' } } as Request;
    const next = vi.fn();

    requireAuth(req, fakeResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('rejeita token inválido', () => {
    const req = { headers: { authorization: 'Bearer token-invalido' } } as Request;
    const next = vi.fn();

    requireAuth(req, fakeResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('anexa req.auth e segue adiante com um token válido', () => {
    const token = signAccessToken('user-123');
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const next = vi.fn();

    requireAuth(req, fakeResponse(), next);

    expect(req.auth).toEqual({ userId: 'user-123' });
    expect(next).toHaveBeenCalledWith();
  });
});
