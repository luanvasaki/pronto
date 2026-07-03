import { NextFunction, Request, Response } from 'express';
import { refreshSession } from './refresh-session';

export async function refreshSessionHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    const tokens = await refreshSession(refreshToken);
    res.status(200).json(tokens);
  } catch (error) {
    next(error);
  }
}
