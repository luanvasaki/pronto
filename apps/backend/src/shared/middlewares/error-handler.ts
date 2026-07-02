import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../errors/http-error';

/**
 * Middleware de erro central do Express (identificado pela assinatura de 4
 * argumentos). Toda rota deve chamar `next(erro)` em vez de responder o
 * erro diretamente — assim o formato da resposta de erro fica igual em
 * qualquer parte da API.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
}
