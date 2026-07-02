import { NextFunction, Request, Response } from 'express';
import { OtpCodeStore } from './otp-code-store';
import { verifyOtp } from './verify-otp';

export function createVerifyOtpHandler(store: OtpCodeStore) {
  return async function verifyOtpHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { phone, code } = req.body as { phone?: string; code?: string };
      const result = await verifyOtp(phone, code, store);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
