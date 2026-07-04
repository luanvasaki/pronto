import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { cancelJobHandler } from './cancel-job.controller';
import { createJobHandler } from './create-job.controller';
import { listMyJobsHandler } from './list-my-jobs.controller';
import { listNearbyJobsHandler } from './list-nearby-jobs.controller';
import { updateJobHandler } from './update-job.controller';

export const jobsRoutes = Router();

jobsRoutes.post('/jobs', requireAuth, createJobHandler);
jobsRoutes.get('/jobs/mine', requireAuth, listMyJobsHandler);
jobsRoutes.get('/jobs/nearby', requireAuth, listNearbyJobsHandler);
jobsRoutes.patch('/jobs/:id', requireAuth, updateJobHandler);
jobsRoutes.post('/jobs/:id/cancel', requireAuth, cancelJobHandler);
