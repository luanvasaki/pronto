import { refreshSession } from './auth-api';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiFetchOptions extends RequestInit {
  /**
   * Pula a renovação automática em 401. Usado pelos próprios endpoints
   * de autenticação (login, registro, refresh, google, logout) — ali um
   * 401 é resposta de negócio (credencial inválida, refresh token
   * expirado) e não sessão expirada; tentar renovar geraria uma chamada
   * inútil ou, no caso do /auth/refresh, recursão infinita.
   */
  skipAuthRetry?: boolean;
}

async function rawFetch(path: string, options: RequestInit): Promise<Response> {
  // FormData (upload de arquivo) precisa que o navegador defina o
  // Content-Type sozinho (com o boundary do multipart) — forçar
  // application/json aqui quebraria o envio.
  const isFormData = options.body instanceof FormData;

  // `credentials: 'include'` é o que faz o navegador mandar o cookie
  // de sessão httpOnly numa chamada cross-origin (worker/business →
  // backend, portas diferentes) — sem isso o cookie simplesmente não vai.
  return fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: isFormData ? options.headers : { 'Content-Type': 'application/json', ...options.headers },
  });
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = body && typeof body === 'object' && 'error' in body ? body.error : undefined;
    const message = typeof errorMessage === 'string' ? errorMessage : 'Algo deu errado. Tente de novo.';
    throw new ApiError(response.status, message);
  }

  return body as T;
}

/**
 * Access token dura só 15min (ver apps/backend/src/modules/auth/jwt.ts).
 * Em vez de deixar cada chamador lidar com sessão expirada na mão, um
 * 401 aqui tenta renovar (refresh token de 30 dias, em cookie httpOnly)
 * e repete a chamada original uma única vez antes de propagar o erro.
 * `refreshSession` já deduplica chamadas concorrentes (ver auth-api.ts).
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { skipAuthRetry, ...init } = options;
  const response = await rawFetch(path, init);

  if (response.status === 401 && !skipAuthRetry) {
    try {
      await refreshSession();
    } catch {
      return parseResponse<T>(response);
    }
    const retried = await rawFetch(path, init);
    return parseResponse<T>(retried);
  }

  return parseResponse<T>(response);
}
