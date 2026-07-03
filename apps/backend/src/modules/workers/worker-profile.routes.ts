import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { upsertWorkerProfileHandler } from './upsert-worker-profile.controller';

export const workerProfileRoutes = Router();

workerProfileRoutes.put('/worker-profile', requireAuth, upsertWorkerProfileHandler);
