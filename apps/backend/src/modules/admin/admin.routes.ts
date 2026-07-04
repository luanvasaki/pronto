import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { getDocumentFileHandler } from './get-document-file.controller';
import { listPendingVerificationsHandler } from './list-pending-verifications.controller';
import { requireAdmin } from './require-admin';
import { reviewCompanyHandler } from './review-company.controller';
import { reviewDocumentHandler } from './review-document.controller';

export const adminRoutes = Router();

adminRoutes.get('/admin/verifications', requireAuth, requireAdmin, listPendingVerificationsHandler);
adminRoutes.get('/admin/documents/:id/file', requireAuth, requireAdmin, getDocumentFileHandler);
adminRoutes.patch('/admin/documents/:id', requireAuth, requireAdmin, reviewDocumentHandler);
adminRoutes.patch('/admin/companies/:id/verification', requireAuth, requireAdmin, reviewCompanyHandler);
