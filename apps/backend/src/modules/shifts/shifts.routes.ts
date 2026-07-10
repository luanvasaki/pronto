import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { createPaymentGateway } from '../payments/create-payment-gateway';
import { checkInHandler } from './check-in.controller';
import { createCheckOutHandler } from './check-out.controller';
import { listMyShiftsHandler } from './list-my-shifts.controller';
import { markShiftCheckInSeenHandler } from './mark-shift-check-in-seen.controller';

export const shiftsRoutes = Router();

const paymentGateway = createPaymentGateway();

shiftsRoutes.get('/shifts/mine', requireAuth, listMyShiftsHandler);
shiftsRoutes.post('/shifts/:id/check-in', requireAuth, checkInHandler);
shiftsRoutes.post('/shifts/:id/check-out', requireAuth, createCheckOutHandler(paymentGateway));
shiftsRoutes.patch('/shifts/:id/check-in/seen', requireAuth, markShiftCheckInSeenHandler);
