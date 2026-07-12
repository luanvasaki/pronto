import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { createWriteRateLimiter } from '../../shared/middlewares/rate-limit';
import { createApplicationHandler } from './create-application.controller';
import { listJobApplicationsHandler } from './list-job-applications.controller';
import { listMyApplicationsHandler } from './list-my-applications.controller';
import { markApplicationSeenHandler } from './mark-application-seen.controller';
import { markRemovalSeenHandler } from './mark-removal-seen.controller';
import { removeApprovedWorkerHandler } from './remove-approved-worker.controller';
import { updateApplicationStatusHandler } from './update-application-status.controller';
import { withdrawApplicationHandler } from './withdraw-application.controller';

export const applicationsRoutes = Router();

const writeRateLimiter = createWriteRateLimiter();

applicationsRoutes.post('/jobs/:jobId/applications', requireAuth, writeRateLimiter, createApplicationHandler);
applicationsRoutes.get('/applications/mine', requireAuth, listMyApplicationsHandler);
applicationsRoutes.get('/jobs/:jobId/applications', requireAuth, listJobApplicationsHandler);
applicationsRoutes.patch('/applications/:id', requireAuth, writeRateLimiter, updateApplicationStatusHandler);
applicationsRoutes.patch('/applications/:id/seen', requireAuth, writeRateLimiter, markApplicationSeenHandler);
applicationsRoutes.patch('/applications/:id/removal-seen', requireAuth, writeRateLimiter, markRemovalSeenHandler);
applicationsRoutes.patch('/applications/:id/remove', requireAuth, writeRateLimiter, removeApprovedWorkerHandler);
applicationsRoutes.patch('/applications/:id/withdraw', requireAuth, writeRateLimiter, withdrawApplicationHandler);
