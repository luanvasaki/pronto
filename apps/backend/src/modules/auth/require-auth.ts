import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { verifyAccessToken } from './jwt';

const BEARER_PREFIX = 'Bearer ';
const GENERIC_AUTH_ERROR = 'Sessão inválida ou expirada.';

/**
 * Nunca diferencia o motivo do 401 pro cliente (ausente, mal
 * formado, expirado, assinatura inválida) — são todos a mesma
 * resposta genérica, informação de motivo ajuda quem tenta adivinhar
 * um token válido.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith(BEARER_PREFIX)) {
    next(new HttpError(401, GENERIC_AUTH_ERROR));
    return;
  }

  const token = header.slice(BEARER_PREFIX.length);

  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub };
    next();
  } catch {
    next(new HttpError(401, GENERIC_AUTH_ERROR));
  }
}
