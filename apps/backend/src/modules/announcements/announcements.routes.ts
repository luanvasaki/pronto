import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { createWriteRateLimiter } from '../../shared/middlewares/rate-limit';
import { createAnnouncementHandler } from './create-announcement.controller';
import { listJobAnnouncementsHandler } from './list-job-announcements.controller';

export const announcementsRoutes = Router();

const writeRateLimiter = createWriteRateLimiter();

announcementsRoutes.post('/jobs/:jobId/announcements', requireAuth, writeRateLimiter, createAnnouncementHandler);
announcementsRoutes.get('/jobs/:jobId/announcements', requireAuth, listJobAnnouncementsHandler);
