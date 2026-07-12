import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { createWriteRateLimiter } from '../../shared/middlewares/rate-limit';
import { cancelJobHandler } from './cancel-job.controller';
import { createJobHandler } from './create-job.controller';
import { getJobDetailHandler } from './get-job-detail.controller';
import { listMyJobsHandler } from './list-my-jobs.controller';
import { listNearbyJobsHandler } from './list-nearby-jobs.controller';
import { updateJobHandler } from './update-job.controller';

export const jobsRoutes = Router();

const writeRateLimiter = createWriteRateLimiter();

jobsRoutes.post('/jobs', requireAuth, writeRateLimiter, createJobHandler);
jobsRoutes.get('/jobs/mine', requireAuth, listMyJobsHandler);
jobsRoutes.get('/jobs/nearby', requireAuth, listNearbyJobsHandler);
jobsRoutes.get('/jobs/:id', requireAuth, getJobDetailHandler);
jobsRoutes.patch('/jobs/:id', requireAuth, updateJobHandler);
jobsRoutes.post('/jobs/:id/cancel', requireAuth, cancelJobHandler);
