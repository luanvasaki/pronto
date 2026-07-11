import { Router } from 'express';
import { createAuthRateLimiter } from '../../shared/middlewares/rate-limit';
import { changePasswordHandler } from './change-password.controller';
import { createEmailSender } from './create-email-sender';
import { createGoogleTokenVerifier } from './create-google-token-verifier';
import { EmailSender } from './email-sender';
import { createForgotPasswordHandler } from './forgot-password.controller';
import { createGoogleLoginHandler } from './google-login.controller';
import { GoogleTokenVerifier } from './google-token-verifier';
import { loginHandler } from './login.controller';
import { logoutHandler } from './logout.controller';
import { getMeHandler } from './me.controller';
import { refreshSessionHandler } from './refresh-session.controller';
import { registerHandler } from './register.controller';
import { requireAuth } from './require-auth';
import { resetPasswordHandler } from './reset-password.controller';

export interface AuthRoutesOptions {
  emailSender?: EmailSender;
  googleTokenVerifier?: GoogleTokenVerifier;
}

/**
 * Fábrica (não `Router()` direto em nível de módulo) pra permitir
 * injetar dublês de `EmailSender`/`GoogleTokenVerifier` nos testes —
 * sem isso, testar forgot-password/google exigiria rede real.
 */
export function createAuthRoutes(options: AuthRoutesOptions = {}): Router {
  const authRoutes = Router();
  const emailSender = options.emailSender ?? createEmailSender();
  const googleTokenVerifier = options.googleTokenVerifier ?? createGoogleTokenVerifier();
  const authRateLimiter = createAuthRateLimiter();

  authRoutes.post('/auth/register', authRateLimiter, registerHandler);
  authRoutes.post('/auth/login', authRateLimiter, loginHandler);
  authRoutes.post('/auth/google', authRateLimiter, createGoogleLoginHandler(googleTokenVerifier));
  authRoutes.post('/auth/forgot-password', authRateLimiter, createForgotPasswordHandler(emailSender));
  authRoutes.post('/auth/reset-password', authRateLimiter, resetPasswordHandler);
  authRoutes.get('/auth/me', requireAuth, getMeHandler);
  authRoutes.post('/auth/change-password', requireAuth, changePasswordHandler);
  authRoutes.post('/auth/refresh', authRateLimiter, refreshSessionHandler);
  authRoutes.post('/auth/logout', logoutHandler);

  return authRoutes;
}
