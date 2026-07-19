import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { createWriteRateLimiter } from '../../shared/middlewares/rate-limit';
import { listCompanyRatingsHandler } from '../ratings/list-company-ratings.controller';
import { getCompanyNotificationsHandler } from './get-notifications.controller';
import { getCompanyDashboardHandler } from './get-dashboard.controller';
import { getCompanyGrowthMetricsHandler } from './get-company-growth-metrics.controller';
import { getLiveEventStatusHandler } from './get-live-event.controller';
import { getCompanyProfileHandler } from './get-company-profile.controller';
import { getCompanyWorkerHistoryHandler } from './get-worker-history.controller';
import { upsertCompanyProfileHandler } from './upsert-company-profile.controller';
import { uploadCompanyLogoHandler, uploadCompanyLogoMiddleware } from './upload-company-logo.controller';
import {
  uploadCompanyDocumentHandler,
  uploadCompanyDocumentMiddleware,
} from './upload-company-document.controller';

export const companyProfileRoutes = Router();

const writeRateLimiter = createWriteRateLimiter();

companyProfileRoutes.get('/company-profile/me', requireAuth, getCompanyProfileHandler);
companyProfileRoutes.get('/company-profile/ratings', requireAuth, listCompanyRatingsHandler);
companyProfileRoutes.get('/company-profile/notifications', requireAuth, getCompanyNotificationsHandler);
companyProfileRoutes.get('/company-profile/dashboard', requireAuth, getCompanyDashboardHandler);
companyProfileRoutes.get('/company-profile/growth-metrics', requireAuth, getCompanyGrowthMetricsHandler);
companyProfileRoutes.get('/company-profile/worker-history', requireAuth, getCompanyWorkerHistoryHandler);
companyProfileRoutes.get('/company-profile/live-event', requireAuth, getLiveEventStatusHandler);
companyProfileRoutes.put('/company-profile', requireAuth, writeRateLimiter, upsertCompanyProfileHandler);
companyProfileRoutes.post(
  '/company-profile/logo',
  requireAuth,
  writeRateLimiter,
  uploadCompanyLogoMiddleware,
  uploadCompanyLogoHandler,
);
companyProfileRoutes.post(
  '/company-profile/document',
  requireAuth,
  writeRateLimiter,
  uploadCompanyDocumentMiddleware,
  uploadCompanyDocumentHandler,
);
