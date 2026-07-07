import { apiFetch } from './api';

export interface UserResponse {
  id: string;
  email: string;
  status: string;
  isAdmin: boolean;
  googlePhotoUrl: string | null;
}

export function register(
  email: string,
  password: string,
  termsAccepted: boolean,
): Promise<{ user: UserResponse }> {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, termsAccepted }),
  });
}

export function login(email: string, password: string): Promise<{ user: UserResponse }> {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function googleLogin(idToken: string, termsAccepted: boolean): Promise<{ user: UserResponse }> {
  return apiFetch('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken, termsAccepted }),
  });
}

export function forgotPassword(email: string): Promise<{ message: string }> {
  return apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  return apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

export function getCurrentUser(): Promise<{ user: UserResponse }> {
  return apiFetch('/auth/me');
}

/** Troca o refresh token por um novo par de tokens — só isso, sem retornar dados do usuário. */
export function refreshSession(): Promise<{ success: true }> {
  return apiFetch('/auth/refresh', { method: 'POST' });
}

export function logout(): Promise<{ message: string }> {
  return apiFetch('/auth/logout', { method: 'POST' });
}
