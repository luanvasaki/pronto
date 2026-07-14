import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { createWriteRateLimiter } from '../../shared/middlewares/rate-limit';
import { getVapidPublicKeyHandler } from './vapid-public-key.controller';
import { subscribeToPushHandler } from './subscribe.controller';
import { unsubscribeFromPushHandler } from './unsubscribe.controller';

export const pushRoutes = Router();

const writeRateLimiter = createWriteRateLimiter();

pushRoutes.get('/push/vapid-public-key', getVapidPublicKeyHandler);
pushRoutes.post('/push/subscribe', requireAuth, writeRateLimiter, subscribeToPushHandler);
pushRoutes.post('/push/unsubscribe', requireAuth, writeRateLimiter, unsubscribeFromPushHandler);
