import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { createRatingHandler } from './create-rating.controller';

export const ratingsRoutes = Router();

ratingsRoutes.post('/shifts/:id/rating', requireAuth, createRatingHandler);
