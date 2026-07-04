import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { upsertCompanyProfileHandler } from './upsert-company-profile.controller';

export const companyProfileRoutes = Router();

companyProfileRoutes.put('/company-profile', requireAuth, upsertCompanyProfileHandler);
