import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { listCompanyRatingsHandler } from '../ratings/list-company-ratings.controller';
import { getCompanyNotificationsHandler } from './get-notifications.controller';
import { getCompanyProfileHandler } from './get-company-profile.controller';
import { upsertCompanyProfileHandler } from './upsert-company-profile.controller';
import { uploadCompanyLogoHandler, uploadCompanyLogoMiddleware } from './upload-company-logo.controller';

export const companyProfileRoutes = Router();

companyProfileRoutes.get('/company-profile/me', requireAuth, getCompanyProfileHandler);
companyProfileRoutes.get('/company-profile/ratings', requireAuth, listCompanyRatingsHandler);
companyProfileRoutes.get('/company-profile/notifications', requireAuth, getCompanyNotificationsHandler);
companyProfileRoutes.put('/company-profile', requireAuth, upsertCompanyProfileHandler);
companyProfileRoutes.post(
  '/company-profile/logo',
  requireAuth,
  uploadCompanyLogoMiddleware,
  uploadCompanyLogoHandler,
);
