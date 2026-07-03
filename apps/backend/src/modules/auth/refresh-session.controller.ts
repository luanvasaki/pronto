import { NextFunction, Request, Response } from 'express';
import { getRefreshTokenCookie, setAuthCookies } from './cookies';
import { refreshSession } from './refresh-session';

export async function refreshSessionHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tokens = await refreshSession(getRefreshTokenCookie(req));
    setAuthCookies(res, tokens);
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
}
