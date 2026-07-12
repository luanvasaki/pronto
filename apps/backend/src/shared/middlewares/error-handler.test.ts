import { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../errors/http-error';
import { errorHandler } from './error-handler';

function fakeRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('errorHandler', () => {
  it('responde com o status e mensagem de um HttpError', () => {
    const res = fakeRes();

    errorHandler(new HttpError(404, 'Não encontrado.'), {} as Request, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Não encontrado.' });
  });

  it('responde 500 genérico pra erro desconhecido, sem lançar mesmo sem Sentry configurado', () => {
    const res = fakeRes();

    expect(() => errorHandler(new Error('algo quebrou'), {} as Request, res, vi.fn())).not.toThrow();

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Erro interno do servidor.' });
  });
});
