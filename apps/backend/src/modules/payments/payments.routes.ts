import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { createPaymentGateway } from './create-payment-gateway';
import { createReleasePaymentHandler } from './release-payment.controller';

export const paymentsRoutes = Router();

// Instância própria — o mock é stateless, então não há necessidade de
// compartilhar a mesma instância usada em shifts.routes.ts.
const paymentGateway = createPaymentGateway();

paymentsRoutes.post('/shifts/:id/payment/release', requireAuth, createReleasePaymentHandler(paymentGateway));
