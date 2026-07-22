import { NextFunction, Request, Response } from 'express';
import { setAuthCookies } from './cookies';
import { googleLogin } from './google-login';
import { GoogleTokenVerifier } from './google-token-verifier';

export function createGoogleLoginHandler(verifier: GoogleTokenVerifier) {
  return async function googleLoginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { idToken } = req.body as { idToken?: string };
      const result = await googleLogin(idToken, verifier);

      setAuthCookies(res, result);
      res.status(200).json({ user: result.user });
    } catch (error) {
      next(error);
    }
  };
}
