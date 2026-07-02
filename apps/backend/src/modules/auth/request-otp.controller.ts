import { NextFunction, Request, Response } from 'express';
import { OtpCodeStore } from './otp-code-store';
import { OtpSender } from './otp-sender';
import { requestOtp } from './request-otp';

export function createRequestOtpHandler(store: OtpCodeStore, sender: OtpSender) {
  return async function requestOtpHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { phone } = req.body as { phone?: string };
      await requestOtp(phone, store, sender);
      res.status(200).json({ message: 'Código enviado.' });
    } catch (error) {
      next(error);
    }
  };
}
