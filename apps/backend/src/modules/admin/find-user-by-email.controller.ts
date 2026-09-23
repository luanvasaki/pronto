import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../shared/errors/http-error';
import { findUserByEmail } from './find-user-by-email';

export async function findUserByEmailHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const email = req.query.email;
    if (typeof email !== 'string' || email.trim().length === 0) {
      throw new HttpError(400, 'Informe um e-mail pra buscar.');
    }

    const user = await findUserByEmail(email);
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}
