import { NextFunction, Request, Response } from 'express';
import { resetPassword } from './reset-password';

export async function resetPasswordHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, newPassword } = req.body as { token?: string; newPassword?: string };
    await resetPassword(token, newPassword);

    res.status(200).json({ message: 'Senha redefinida.' });
  } catch (error) {
    next(error);
  }
}
