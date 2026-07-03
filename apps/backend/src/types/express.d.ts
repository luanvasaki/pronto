import 'express';

declare global {
  namespace Express {
    interface Request {
      /** Preenchido por `requireAuth` — ausente em rota pública. */
      auth?: { userId: string };
    }
  }
}
