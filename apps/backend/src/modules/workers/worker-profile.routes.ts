import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { getWorkerProfileHandler } from './get-worker-profile.controller';
import { updateWorkerLocationHandler } from './update-worker-location.controller';
import { upsertWorkerProfileHandler } from './upsert-worker-profile.controller';
import { uploadWorkerPhotoHandler, uploadWorkerPhotoMiddleware } from './upload-worker-photo.controller';

export const workerProfileRoutes = Router();

workerProfileRoutes.get('/worker-profile/me', requireAuth, getWorkerProfileHandler);
workerProfileRoutes.put('/worker-profile', requireAuth, upsertWorkerProfileHandler);
workerProfileRoutes.patch('/worker-profile/location', requireAuth, updateWorkerLocationHandler);
workerProfileRoutes.post(
  '/worker-profile/photo',
  requireAuth,
  uploadWorkerPhotoMiddleware,
  uploadWorkerPhotoHandler,
);
