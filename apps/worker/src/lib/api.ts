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

/**
 * `credentials: 'include'` é o que faz o navegador mandar o cookie
 * de sessão httpOnly numa chamada cross-origin (worker → backend,
 * portas diferentes) — sem isso o cookie simplesmente não vai.
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof body.error === 'string' ? body.error : 'Algo deu errado. Tente de novo.';
    throw new ApiError(response.status, message);
  }

  return body as T;
}
