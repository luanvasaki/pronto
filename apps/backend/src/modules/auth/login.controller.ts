import { NextFunction, Request, Response } from 'express';
import { setAuthCookies } from './cookies';
import { login } from './login';

export async function loginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    const result = await login(email, password);

    setAuthCookies(res, result);
    res.status(200).json({ user: result.user });
  } catch (error) {
    next(error);
  }
}
