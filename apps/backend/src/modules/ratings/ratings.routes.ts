import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { createWriteRateLimiter } from '../../shared/middlewares/rate-limit';
import { createRatingHandler } from './create-rating.controller';

export const ratingsRoutes = Router();

const writeRateLimiter = createWriteRateLimiter();

ratingsRoutes.post('/shifts/:id/rating', requireAuth, writeRateLimiter, createRatingHandler);
