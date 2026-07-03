import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from './api';

function mockFetch(response: { ok: boolean; status?: number; json: () => Promise<unknown> }) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('inclui credentials e Content-Type na chamada', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/auth/otp/request', { method: 'POST', body: '{}' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/otp/request'),
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
  });

  it('não força Content-Type quando o corpo é FormData', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const formData = new FormData();
    formData.append('document', new Blob(['x']));

    await apiFetch('/worker-profile/document', { method: 'POST', body: formData });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers).toBeUndefined();
  });

  it('retorna o corpo desserializado quando a resposta é ok', async () => {
    mockFetch({ ok: true, json: async () => ({ user: { id: '1' } }) });

    const result = await apiFetch<{ user: { id: string } }>('/auth/me');

    expect(result.user.id).toBe('1');
  });

  it('lança ApiError com a mensagem do backend quando a resposta falha', async () => {
    mockFetch({ ok: false, status: 401, json: async () => ({ error: 'Sessão inválida.' }) });

    await expect(apiFetch('/auth/me')).rejects.toThrow('Sessão inválida.');
  });

  it('usa mensagem genérica quando o corpo do erro não tem "error"', async () => {
    mockFetch({ ok: false, status: 500, json: async () => ({}) });

    await expect(apiFetch('/auth/me')).rejects.toThrow('Algo deu errado');
  });

  it('expõe o status HTTP no ApiError', async () => {
    mockFetch({ ok: false, status: 429, json: async () => ({ error: 'Aguarde.' }) });

    try {
      await apiFetch('/auth/otp/request');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(429);
    }
  });
});
