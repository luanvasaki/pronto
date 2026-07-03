import { apiFetch } from './api';

export interface UserResponse {
  id: string;
  phone: string;
  status: string;
}

export interface VerifyOtpResponse {
  user: UserResponse;
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

export function getCurrentUser(): Promise<{ user: UserResponse }> {
  return apiFetch('/auth/me');
}

/** Troca o refresh token por um novo par de tokens — só isso, sem retornar dados do usuário. */
export function refreshSession(): Promise<{ success: true }> {
  return apiFetch('/auth/refresh', { method: 'POST' });
}
