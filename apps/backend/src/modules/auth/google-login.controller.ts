import { NextFunction, Request, Response } from 'express';
import { setAuthCookies } from './cookies';
import { googleLogin } from './google-login';
import { GoogleTokenVerifier } from './google-token-verifier';

export function createGoogleLoginHandler(verifier: GoogleTokenVerifier) {
  return async function googleLoginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { idToken, termsAccepted } = req.body as { idToken?: string; termsAccepted?: boolean };
      const result = await googleLogin(idToken, termsAccepted, verifier);

      setAuthCookies(res, result);
      res.status(200).json({ user: result.user });
    } catch (error) {
      next(error);
    }
  };
}
