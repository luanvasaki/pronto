import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { setUserAdmin } from './set-user-admin';

export async function setUserAdminHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actorUserId = req.auth?.userId;
    if (!actorUserId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const targetUserId = req.params.id;
    if (typeof targetUserId !== 'string') {
      throw new HttpError(404, 'Usuário não encontrado.');
    }

    const { isAdmin } = req.body as { isAdmin?: unknown };
    if (typeof isAdmin !== 'boolean') {
      throw new HttpError(400, '"isAdmin" precisa ser true ou false.');
    }

    const result = await setUserAdmin(actorUserId, targetUserId, isAdmin);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
