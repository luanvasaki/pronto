import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { createWriteRateLimiter } from '../../shared/middlewares/rate-limit';
import { cancelJobHandler } from './cancel-job.controller';
import { createJobHandler } from './create-job.controller';
import { duplicateWeekHandler } from './duplicate-week.controller';
import { geocodeJobAddressHandler } from './geocode-job-address.controller';
import { getJobDetailHandler } from './get-job-detail.controller';
import { listMyJobsHandler } from './list-my-jobs.controller';
import { listNearbyJobsHandler } from './list-nearby-jobs.controller';
import { updateJobHandler } from './update-job.controller';

export const jobsRoutes = Router();

const writeRateLimiter = createWriteRateLimiter();

jobsRoutes.post('/jobs', requireAuth, writeRateLimiter, createJobHandler);
jobsRoutes.post('/jobs/geocode-address', requireAuth, writeRateLimiter, geocodeJobAddressHandler);
jobsRoutes.post('/jobs/duplicate-week', requireAuth, writeRateLimiter, duplicateWeekHandler);
jobsRoutes.get('/jobs/mine', requireAuth, listMyJobsHandler);
jobsRoutes.get('/jobs/nearby', requireAuth, listNearbyJobsHandler);
jobsRoutes.get('/jobs/:id', requireAuth, getJobDetailHandler);
jobsRoutes.patch('/jobs/:id', requireAuth, writeRateLimiter, updateJobHandler);
jobsRoutes.post('/jobs/:id/cancel', requireAuth, writeRateLimiter, cancelJobHandler);
