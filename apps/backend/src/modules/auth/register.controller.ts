import { NextFunction, Request, Response } from 'express';
import { setAuthCookies } from './cookies';
import { EmailSender } from './email-sender';
import { register } from './register';

export function createRegisterHandler(sender: EmailSender) {
  return async function registerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      const result = await register(email, password, sender);

      setAuthCookies(res, result);
      res.status(201).json({ user: result.user });
    } catch (error) {
      next(error);
    }
  };
}
