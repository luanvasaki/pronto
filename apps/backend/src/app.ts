import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Express } from 'express';
import { env } from './config/env';
import { authRoutes } from './modules/auth/auth.routes';
import { healthRoutes } from './modules/health/health.routes';
import { workerDocumentRoutes } from './modules/workers/worker-document.routes';
import { workerProfileRoutes } from './modules/workers/worker-profile.routes';
import { errorHandler } from './shared/middlewares/error-handler';
import { notFoundHandler } from './shared/middlewares/not-found';

/**
 * Monta a aplicação Express sem chamar `listen`. Isso permite que os
 * testes importem `app` diretamente e usem supertest sem abrir uma
 * porta de rede de verdade.
 */
export function createApp(): Express {
  const app = express();

  // origin específica + credentials: true — cookie cross-origin não
  // anda com origin: '*', o navegador bloqueia essa combinação.
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());

  app.use(healthRoutes);
  app.use(authRoutes);
  app.use(workerProfileRoutes);
  app.use(workerDocumentRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
