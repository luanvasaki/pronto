import { Router } from 'express';
import { createOtpSender } from './create-otp-sender';
import { otpCodeStore } from './otp-code-store';
import { createRequestOtpHandler } from './request-otp.controller';
import { createVerifyOtpHandler } from './verify-otp.controller';

export const authRoutes = Router();

const otpSender = createOtpSender();

authRoutes.post('/auth/otp/request', createRequestOtpHandler(otpCodeStore, otpSender));
authRoutes.post('/auth/otp/verify', createVerifyOtpHandler(otpCodeStore));
