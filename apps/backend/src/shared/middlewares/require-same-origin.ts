import { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';
import { HttpError } from '../errors/http-error';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Defesa contra CSRF: em produção o cookie de sessão é `sameSite:
 * 'none'` (necessário porque front e back são domínios diferentes de
 * verdade — ver cookies.ts), então um <form> de outro site consegue
 * mandar o cookie junto numa requisição "simples" (ex.:
 * application/x-www-form-urlencoded) — CORS sozinho só impede o
 * JavaScript de LER a resposta, não impede o navegador de ENVIAR essa
 * requisição.
 *
 * Navegador sempre manda `Origin` em POST/PUT/PATCH/DELETE de verdade
 * (fetch legítimo do próprio front ou form de outro site) — aqui
 * rejeita quando ela vem preenchida mas não está na mesma lista de
 * CORS_ORIGINS. Ausência de `Origin` (curl, chamada servidor-a-servidor,
 * testes) passa direto: esse não é o vetor que isso protege.
 */
export function requireSameOrigin(req: Request, _res: Response, next: NextFunction): void {
  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }

  const origin = req.headers.origin;
  if (origin && !env.corsOrigins.includes(origin)) {
    next(new HttpError(403, 'Requisição recusada.'));
    return;
  }

  next();
}
