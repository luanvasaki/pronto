import { Router } from 'express';
import { requireAuth } from '../auth/require-auth';
import { checkInHandler } from './check-in.controller';
import { checkOutHandler } from './check-out.controller';
import { listMyShiftsHandler } from './list-my-shifts.controller';

export const shiftsRoutes = Router();

shiftsRoutes.get('/shifts/mine', requireAuth, listMyShiftsHandler);
shiftsRoutes.post('/shifts/:id/check-in', requireAuth, checkInHandler);
shiftsRoutes.post('/shifts/:id/check-out', requireAuth, checkOutHandler);
