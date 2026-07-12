import { NextFunction, Request, Response } from 'express';
import { Sentry } from '../../config/sentry';
import { HttpError } from '../errors/http-error';

/**
 * Middleware de erro central do Express (identificado pela assinatura de 4
 * argumentos). Toda rota deve chamar `next(erro)` em vez de responder o
 * erro diretamente — assim o formato da resposta de erro fica igual em
 * qualquer parte da API.
 *
 * Só reporta pro Sentry o que vira 500 — HttpError é erro esperado
 * (validação, 404, 403 etc.), não uma falha real do sistema que alguém
 * precise ser avisado. Sem SENTRY_DSN configurada, captureException não
 * faz nada (ver config/sentry.ts) — continua só no console.error de sempre.
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
  Sentry.captureException(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
}
