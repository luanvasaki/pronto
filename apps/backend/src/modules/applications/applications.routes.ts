import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { createApplicationHandler } from './create-application.controller';
import { listJobApplicationsHandler } from './list-job-applications.controller';
import { listMyApplicationsHandler } from './list-my-applications.controller';
import { updateApplicationStatusHandler } from './update-application-status.controller';

export const applicationsRoutes = Router();

applicationsRoutes.post('/jobs/:jobId/applications', requireAuth, createApplicationHandler);
applicationsRoutes.get('/applications/mine', requireAuth, listMyApplicationsHandler);
applicationsRoutes.get('/jobs/:jobId/applications', requireAuth, listJobApplicationsHandler);
applicationsRoutes.patch('/applications/:id', requireAuth, updateApplicationStatusHandler);
