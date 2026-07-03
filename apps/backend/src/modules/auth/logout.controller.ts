import { NextFunction, Request, Response } from 'express';
import { clearAuthCookies, getRefreshTokenCookie } from './cookies';
import { logout } from './logout';

export async function logoutHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const refreshToken = getRefreshTokenCookie(req);
    // Sem cookie nenhum é "já deslogado", não erro — o navegador não
    // sabe se existe sessão antes de chamar (o cookie é httpOnly).
    if (refreshToken) {
      await logout(refreshToken);
    }
    clearAuthCookies(res);
    res.status(200).json({ message: 'Sessão encerrada.' });
  } catch (error) {
    next(error);
  }
}
