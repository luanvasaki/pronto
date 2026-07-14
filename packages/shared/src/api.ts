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
 * de sessão httpOnly numa chamada cross-origin (worker/business →
 * backend, portas diferentes) — sem isso o cookie simplesmente não vai.
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  // FormData (upload de arquivo) precisa que o navegador defina o
  // Content-Type sozinho (com o boundary do multipart) — forçar
  // application/json aqui quebraria o envio.
  const isFormData = options.body instanceof FormData;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: isFormData ? options.headers : { 'Content-Type': 'application/json', ...options.headers },
  });

  const body: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = body && typeof body === 'object' && 'error' in body ? body.error : undefined;
    const message = typeof errorMessage === 'string' ? errorMessage : 'Algo deu errado. Tente de novo.';
    throw new ApiError(response.status, message);
  }

  return body as T;
}
