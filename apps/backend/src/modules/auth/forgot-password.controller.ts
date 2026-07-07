import { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';
import { EmailSender } from './email-sender';
import { forgotPassword } from './forgot-password';

const GENERIC_MESSAGE = 'Se este e-mail existir, enviamos um link de redefinição.';

/**
 * Nunca confia em campo do body pra montar a URL do link — só aceita a
 * origem se estiver na allowlist de CORS (mesma usada pelo `cors()` em
 * app.ts), com fallback pra primeira origem configurada.
 */
function resolveResetBaseUrl(req: Request): string {
  const origin = req.headers.origin;
  if (origin && env.corsOrigins.includes(origin)) {
    return origin;
  }
  return env.corsOrigins[0] ?? '';
}

export function createForgotPasswordHandler(sender: EmailSender) {
  return async function forgotPasswordHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body as { email?: string };
      const resetBaseUrl = resolveResetBaseUrl(req);

      await forgotPassword(email, sender, resetBaseUrl);

      // Resposta idêntica sempre — é aqui que a garantia contra
      // enumeration de e-mail realmente se sustenta, não em forgotPassword.
      res.status(200).json({ message: GENERIC_MESSAGE });
    } catch (error) {
      next(error);
    }
  };
}
