import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { createWriteRateLimiter } from '../../shared/middlewares/rate-limit';
import { confirmPaymentHandler } from './confirm-payment.controller';
import { createPaymentGateway } from './create-payment-gateway';
import { createReleasePaymentHandler } from './release-payment.controller';

export const paymentsRoutes = Router();

// Instância própria — o mock é stateless, então não há necessidade de
// compartilhar a mesma instância usada em shifts.routes.ts.
const paymentGateway = createPaymentGateway();
const writeRateLimiter = createWriteRateLimiter();

paymentsRoutes.post(
  '/shifts/:id/payment/release',
  requireAuth,
  writeRateLimiter,
  createReleasePaymentHandler(paymentGateway),
);
paymentsRoutes.post('/shifts/:id/payment/confirm', requireAuth, writeRateLimiter, confirmPaymentHandler);
