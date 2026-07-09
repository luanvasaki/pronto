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

let inFlightRefresh: Promise<{ success: true }> | null = null;

/**
 * Troca o refresh token por um novo par de tokens — só isso, sem
 * retornar dados do usuário.
 *
 * O refresh token só serve uma vez (o backend derruba TODAS as sessões
 * do usuário se detectar reuso — sinal de roubo). Duas chamadas quase
 * simultâneas (ex: React StrictMode rodando o efeito de checagem de
 * sessão em dobro) mandariam o mesmo token duas vezes e disparariam
 * essa detecção à toa, deslogando o usuário sem motivo real. Por isso,
 * uma chamada em andamento é reaproveitada em vez de disparar outra.
 */
export function refreshSession(): Promise<{ success: true }> {
  if (!inFlightRefresh) {
    inFlightRefresh = apiFetch<{ success: true }>('/auth/refresh', { method: 'POST' }).finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

export function logout(): Promise<{ message: string }> {
  return apiFetch('/auth/logout', { method: 'POST' });
}
