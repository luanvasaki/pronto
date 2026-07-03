import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { uploadDocumentHandler, uploadDocumentMiddleware } from './upload-document.controller';

export const workerDocumentRoutes = Router();

workerDocumentRoutes.post(
  '/worker-profile/document',
  requireAuth,
  uploadDocumentMiddleware,
  uploadDocumentHandler,
);
