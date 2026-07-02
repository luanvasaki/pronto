import express, { Express } from 'express';
import { healthRoutes } from './modules/health/health.routes';
import { errorHandler } from './shared/middlewares/error-handler';
import { notFoundHandler } from './shared/middlewares/not-found';

/**
 * Monta a aplicação Express sem chamar `listen`. Isso permite que os
 * testes importem `app` diretamente e usem supertest sem abrir uma
 * porta de rede de verdade.
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.use(healthRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
