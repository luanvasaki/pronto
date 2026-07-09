import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { deleteDemoDataHandler } from './delete-demo-data.controller';
import { getDocumentFileHandler } from './get-document-file.controller';
import { getMetricsHandler } from './get-metrics.controller';
import { listPendingVerificationsHandler } from './list-pending-verifications.controller';
import { requireAdmin } from './require-admin';
import { reviewCompanyHandler } from './review-company.controller';
import { reviewDocumentHandler } from './review-document.controller';
import { reviewSkillCategoryHandler } from './review-skill-category.controller';

export const adminRoutes = Router();

adminRoutes.get('/admin/metrics', requireAuth, requireAdmin, getMetricsHandler);
adminRoutes.get('/admin/verifications', requireAuth, requireAdmin, listPendingVerificationsHandler);
adminRoutes.get('/admin/documents/:id/file', requireAuth, requireAdmin, getDocumentFileHandler);
adminRoutes.patch('/admin/documents/:id', requireAuth, requireAdmin, reviewDocumentHandler);
adminRoutes.patch('/admin/companies/:id/verification', requireAuth, requireAdmin, reviewCompanyHandler);
adminRoutes.patch('/admin/skill-categories/:id', requireAuth, requireAdmin, reviewSkillCategoryHandler);
adminRoutes.delete('/admin/demo-data', requireAuth, requireAdmin, deleteDemoDataHandler);
