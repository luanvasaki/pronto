import { NextFunction, Request, Response } from 'express';
import { logout } from './logout';

export async function logoutHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    await logout(refreshToken);
    res.status(200).json({ message: 'Sessão encerrada.' });
  } catch (error) {
    next(error);
  }
}
