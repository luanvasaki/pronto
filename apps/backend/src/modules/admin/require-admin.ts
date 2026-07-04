import { eq } from 'drizzle-orm';
import { NextFunction, Request, Response } from 'express';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';

/**
 * Roda depois de requireAuth (precisa de req.auth já preenchido).
 * isAdmin não é auto-atribuível por nenhuma rota — só via update
 * direto no banco (ver README) — por isso a checagem aqui é uma
 * consulta simples, sem cache: são poucas chamadas admin, e o custo
 * de servir uma permissão desatualizada é maior que uma query extra.
 */
export async function requireAdmin(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user?.isAdmin) {
      throw new HttpError(403, 'Acesso restrito a administradores.');
    }

    next();
  } catch (error) {
    next(error);
  }
}
