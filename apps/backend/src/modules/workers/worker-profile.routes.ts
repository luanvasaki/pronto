import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { createWriteRateLimiter } from '../../shared/middlewares/rate-limit';
import { listWorkerRatingsHandler } from '../ratings/list-worker-ratings.controller';
import { getWorkerProfileHandler } from './get-worker-profile.controller';
import { updateWorkerLocationHandler } from './update-worker-location.controller';
import { updateWorkerSearchRadiusHandler } from './update-worker-search-radius.controller';
import { upsertWorkerProfileHandler } from './upsert-worker-profile.controller';
import { uploadWorkerPhotoHandler, uploadWorkerPhotoMiddleware } from './upload-worker-photo.controller';

export const workerProfileRoutes = Router();

const writeRateLimiter = createWriteRateLimiter();

workerProfileRoutes.get('/worker-profile/me', requireAuth, getWorkerProfileHandler);
workerProfileRoutes.get('/worker-profile/ratings', requireAuth, listWorkerRatingsHandler);
workerProfileRoutes.put('/worker-profile', requireAuth, writeRateLimiter, upsertWorkerProfileHandler);
workerProfileRoutes.patch('/worker-profile/location', requireAuth, writeRateLimiter, updateWorkerLocationHandler);
workerProfileRoutes.patch(
  '/worker-profile/search-radius',
  requireAuth,
  writeRateLimiter,
  updateWorkerSearchRadiusHandler,
);
workerProfileRoutes.post(
  '/worker-profile/photo',
  requireAuth,
  writeRateLimiter,
  uploadWorkerPhotoMiddleware,
  uploadWorkerPhotoHandler,
);
