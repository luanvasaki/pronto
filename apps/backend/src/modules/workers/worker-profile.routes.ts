import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { getWorkerProfileHandler } from './get-worker-profile.controller';
import { updateWorkerLocationHandler } from './update-worker-location.controller';
import { upsertWorkerProfileHandler } from './upsert-worker-profile.controller';

export const workerProfileRoutes = Router();

workerProfileRoutes.get('/worker-profile/me', requireAuth, getWorkerProfileHandler);
workerProfileRoutes.put('/worker-profile', requireAuth, upsertWorkerProfileHandler);
workerProfileRoutes.patch('/worker-profile/location', requireAuth, updateWorkerLocationHandler);
