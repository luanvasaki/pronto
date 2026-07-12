import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { createWriteRateLimiter } from '../../shared/middlewares/rate-limit';
import { uploadDocumentHandler, uploadDocumentMiddleware } from './upload-document.controller';

export const workerDocumentRoutes = Router();

const writeRateLimiter = createWriteRateLimiter();

workerDocumentRoutes.post(
  '/worker-profile/document',
  requireAuth,
  writeRateLimiter,
  uploadDocumentMiddleware,
  uploadDocumentHandler,
);
