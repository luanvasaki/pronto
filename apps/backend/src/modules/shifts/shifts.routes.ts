import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { createWriteRateLimiter } from '../../shared/middlewares/rate-limit';
import { createPaymentGateway } from '../payments/create-payment-gateway';
import { checkInHandler } from './check-in.controller';
import { checkOutHandler } from './check-out.controller';
import { confirmCheckInHandler } from './confirm-check-in.controller';
import { createConfirmCheckOutHandler } from './confirm-check-out.controller';
import { listMyShiftsHandler } from './list-my-shifts.controller';

export const shiftsRoutes = Router();

const paymentGateway = createPaymentGateway();
const writeRateLimiter = createWriteRateLimiter();

shiftsRoutes.get('/shifts/mine', requireAuth, listMyShiftsHandler);
shiftsRoutes.post('/shifts/:id/check-in', requireAuth, writeRateLimiter, checkInHandler);
shiftsRoutes.post('/shifts/:id/check-out', requireAuth, writeRateLimiter, checkOutHandler);
shiftsRoutes.post('/shifts/:id/check-in/confirm', requireAuth, writeRateLimiter, confirmCheckInHandler);
shiftsRoutes.post(
  '/shifts/:id/check-out/confirm',
  requireAuth,
  writeRateLimiter,
  createConfirmCheckOutHandler(paymentGateway),
);
