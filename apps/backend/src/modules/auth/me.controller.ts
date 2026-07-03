import { eq } from 'drizzle-orm';
import { NextFunction, Request, Response } from 'express';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { toUserResponse } from './user-response';

/** Assume que `requireAuth` já rodou antes — `req.auth` sempre presente aqui. */
export async function getMeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) {
      throw new HttpError(404, 'Usuário não encontrado.');
    }

    res.status(200).json({ user: toUserResponse(user) });
  } catch (error) {
    next(error);
  }
}
