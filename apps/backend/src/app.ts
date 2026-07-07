import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Express } from 'express';
import path from 'node:path';
import { env } from './config/env';
import { adminRoutes } from './modules/admin/admin.routes';
import { applicationsRoutes } from './modules/applications/applications.routes';
import { AuthRoutesOptions, createAuthRoutes } from './modules/auth/auth.routes';
import { companyProfileRoutes } from './modules/companies/company-profile.routes';
import { jobsRoutes } from './modules/jobs/jobs.routes';
import { healthRoutes } from './modules/health/health.routes';
import { paymentsRoutes } from './modules/payments/payments.routes';
import { ratingsRoutes } from './modules/ratings/ratings.routes';
import { skillCategoriesRoutes } from './modules/skill-categories/skill-categories.routes';
import { shiftsRoutes } from './modules/shifts/shifts.routes';
import { workerDocumentRoutes } from './modules/workers/worker-document.routes';
import { workerProfileRoutes } from './modules/workers/worker-profile.routes';
import { errorHandler } from './shared/middlewares/error-handler';
import { notFoundHandler } from './shared/middlewares/not-found';
import { createGeneralRateLimiter } from './shared/middlewares/rate-limit';

/**
 * Monta a aplicação Express sem chamar `listen`. Isso permite que os
 * testes importem `app` diretamente e usem supertest sem abrir uma
 * porta de rede de verdade.
 */
export interface CreateAppOptions {
  authRoutes?: AuthRoutesOptions;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();

  // origin específica + credentials: true — cookie cross-origin não
  // anda com origin: '*', o navegador bloqueia essa combinação.
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());
  app.use(createGeneralRateLimiter());
  // Só serve algo quando o LocalFileStorage é usado (sem BLOB_READ_WRITE_TOKEN
  // configurado, ou seja, dev/teste local) — em produção, foto/logo público
  // vêm direto da URL do Vercel Blob, sem passar por esta rota.
  app.use('/uploads/public', express.static(path.join(process.cwd(), 'uploads', 'public')));

  app.use(healthRoutes);
  app.use(skillCategoriesRoutes);
  app.use(createAuthRoutes(options.authRoutes));
  app.use(companyProfileRoutes);
  app.use(jobsRoutes);
  app.use(applicationsRoutes);
  app.use(shiftsRoutes);
  app.use(ratingsRoutes);
  app.use(paymentsRoutes);
  app.use(workerProfileRoutes);
  app.use(workerDocumentRoutes);
  app.use(adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
