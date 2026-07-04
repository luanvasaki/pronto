import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { createJobHandler } from './create-job.controller';
import { listMyJobsHandler } from './list-my-jobs.controller';
import { listNearbyJobsHandler } from './list-nearby-jobs.controller';

export const jobsRoutes = Router();

jobsRoutes.post('/jobs', requireAuth, createJobHandler);
jobsRoutes.get('/jobs/mine', requireAuth, listMyJobsHandler);
jobsRoutes.get('/jobs/nearby', requireAuth, listNearbyJobsHandler);
