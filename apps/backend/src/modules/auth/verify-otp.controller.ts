import { NextFunction, Request, Response } from 'express';
import { setAuthCookies } from './cookies';
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
      const { accessToken, refreshToken, ...result } = await verifyOtp(phone, code, store);
      setAuthCookies(res, { accessToken, refreshToken });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
