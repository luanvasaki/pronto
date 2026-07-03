import { Router } from 'express';
import { createOtpSender } from './create-otp-sender';
import { getMeHandler } from './me.controller';
import { otpCodeStore } from './otp-code-store';
import { requireAuth } from './require-auth';
import { createRequestOtpHandler } from './request-otp.controller';
import { createVerifyOtpHandler } from './verify-otp.controller';

export const authRoutes = Router();

const otpSender = createOtpSender();

authRoutes.post('/auth/otp/request', createRequestOtpHandler(otpCodeStore, otpSender));
authRoutes.post('/auth/otp/verify', createVerifyOtpHandler(otpCodeStore));
authRoutes.get('/auth/me', requireAuth, getMeHandler);
