import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { createEmailSender } from '../auth/create-email-sender';
import { EmailSender } from '../auth/email-sender';
import { deleteDemoDataHandler } from './delete-demo-data.controller';
import { findUserByEmailHandler } from './find-user-by-email.controller';
import { getCompanyDocumentFileHandler } from './get-company-document-file.controller';
import { getConsentDocumentVersionHandler } from './get-consent-document-version.controller';
import { getDocumentFileHandler } from './get-document-file.controller';
import { getGrowthMetricsHandler } from './get-growth-metrics.controller';
import { getMetricsHandler } from './get-metrics.controller';
import { listAdminsHandler } from './list-admins.controller';
import { listCompaniesHandler } from './list-companies.controller';
import { listFailedPaymentsHandler } from './list-failed-payments.controller';
import { listPendingVerificationsHandler } from './list-pending-verifications.controller';
import { listWorkersHandler } from './list-workers.controller';
import { requireAdmin } from './require-admin';
import { requireSuperAdmin } from './require-super-admin';
import { createResetUserPasswordHandler } from './reset-user-password.controller';
import { reviewCompanyHandler } from './review-company.controller';
import { createReviewDocumentHandler } from './review-document.controller';
import { reviewSkillCategoryHandler } from './review-skill-category.controller';
import { setUserAdminHandler } from './set-user-admin.controller';

export interface AdminRoutesOptions {
  emailSender?: EmailSender;
}

/**
 * Fábrica (mesmo motivo de createAuthRoutes) — reset-user-password precisa
 * de EmailSender injetável nos testes, sem depender de rede real.
 */
export function createAdminRoutes(options: AdminRoutesOptions = {}): Router {
  const adminRoutes = Router();
  const emailSender = options.emailSender ?? createEmailSender();

  adminRoutes.get('/admin/metrics', requireAuth, requireAdmin, getMetricsHandler);
  adminRoutes.get('/admin/growth-metrics', requireAuth, requireAdmin, getGrowthMetricsHandler);
  adminRoutes.get('/admin/verifications', requireAuth, requireAdmin, listPendingVerificationsHandler);
  adminRoutes.get('/admin/documents/:id/file', requireAuth, requireAdmin, getDocumentFileHandler);
  adminRoutes.get('/admin/company-documents/:id/file', requireAuth, requireAdmin, getCompanyDocumentFileHandler);
  adminRoutes.patch('/admin/documents/:id', requireAuth, requireAdmin, createReviewDocumentHandler(emailSender));
  adminRoutes.patch('/admin/companies/:id/verification', requireAuth, requireAdmin, reviewCompanyHandler);
  adminRoutes.patch('/admin/skill-categories/:id', requireAuth, requireAdmin, reviewSkillCategoryHandler);
  adminRoutes.delete('/admin/demo-data', requireAuth, requireAdmin, deleteDemoDataHandler);
  adminRoutes.get('/admin/companies', requireAuth, requireAdmin, listCompaniesHandler);
  adminRoutes.get('/admin/workers', requireAuth, requireAdmin, listWorkersHandler);
  adminRoutes.get('/admin/failed-payments', requireAuth, requireAdmin, listFailedPaymentsHandler);
  adminRoutes.post(
    '/admin/users/:id/reset-password',
    requireAuth,
    requireAdmin,
    createResetUserPasswordHandler(emailSender),
  );
  adminRoutes.patch('/admin/users/:id/admin', requireAuth, requireAdmin, requireSuperAdmin, setUserAdminHandler);
  adminRoutes.get('/admin/admins', requireAuth, requireAdmin, requireSuperAdmin, listAdminsHandler);
  adminRoutes.get('/admin/users/find', requireAuth, requireAdmin, requireSuperAdmin, findUserByEmailHandler);
  adminRoutes.get(
    '/admin/consent-documents/:type/:version',
    requireAuth,
    requireAdmin,
    getConsentDocumentVersionHandler,
  );

  return adminRoutes;
}
