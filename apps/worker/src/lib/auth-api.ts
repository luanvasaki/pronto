import { apiFetch } from './api';

export interface VerifyOtpResponse {
  user: { id: string; phone: string; status: string };
  isNewUser: boolean;
}

export function requestOtp(phone: string): Promise<{ message: string }> {
  return apiFetch('/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export function verifyOtp(phone: string, code: string): Promise<VerifyOtpResponse> {
  return apiFetch('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  });
}
