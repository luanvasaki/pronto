import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { getAccessTokenCookie } from './cookies';
import { verifyAccessToken } from './jwt';

const BEARER_PREFIX = 'Bearer ';
const GENERIC_AUTH_ERROR = 'Sessão inválida ou expirada.';

function extractBearerToken(header: string | undefined): string | undefined {
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    return undefined;
  }
  return header.slice(BEARER_PREFIX.length);
}

/**
 * Cookie primeiro (é como o navegador de verdade manda a sessão),
 * header Bearer como alternativa (útil pra automação/teste). Nunca
 * diferencia o motivo do 401 pro cliente (ausente, mal formado,
 * expirado, assinatura inválida) — são todos a mesma resposta
 * genérica, informação de motivo ajuda quem tenta adivinhar um token.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = getAccessTokenCookie(req) ?? extractBearerToken(req.headers.authorization);

  if (!token) {
    next(new HttpError(401, GENERIC_AUTH_ERROR));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub };
    next();
  } catch {
    next(new HttpError(401, GENERIC_AUTH_ERROR));
  }
}
