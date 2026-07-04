import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { getCompanyProfileHandler } from './get-company-profile.controller';
import { upsertCompanyProfileHandler } from './upsert-company-profile.controller';

export const companyProfileRoutes = Router();

companyProfileRoutes.get('/company-profile/me', requireAuth, getCompanyProfileHandler);
companyProfileRoutes.put('/company-profile', requireAuth, upsertCompanyProfileHandler);
