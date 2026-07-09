import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { changePassword } from './change-password';
import { setAuthCookies } from './cookies';

export async function changePasswordHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }

    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    const tokens = await changePassword(userId, currentPassword, newPassword);

    setAuthCookies(res, tokens);
    res.status(200).json({ message: 'Senha alterada.' });
  } catch (error) {
    next(error);
  }
}
