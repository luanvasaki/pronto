import { eq } from 'drizzle-orm';
import { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';

/**
 * Roda depois de requireAuth + requireAdmin. Diferente de isAdmin (uma
 * coluna do banco), "super admin" é uma lista fixa de e-mails na env
 * var SUPER_ADMIN_EMAILS (ver config/env.ts) — só quem está nessa lista
 * pode conceder/revogar isAdmin de outros usuários pela UI. Com a env
 * var vazia (padrão), essa checagem barra todo mundo, mantendo o
 * comportamento histórico de que virar admin exige update direto no
 * banco.
 */
export async function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    const email = user?.email?.toLowerCase();
    if (!email || !env.superAdminEmails.includes(email)) {
      throw new HttpError(403, 'Acesso restrito a administradores autorizados a gerenciar outros administradores.');
    }

    next();
  } catch (error) {
    next(error);
  }
}
