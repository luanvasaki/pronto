import { ApiError } from '@shift/shared';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRequireAuth } from './use-require-auth';

const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

const getCurrentUserMock = vi.fn();
const refreshSessionMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
    refreshSession: (...args: unknown[]) => refreshSessionMock(...args),
  };
});

describe('useRequireAuth', () => {
  beforeEach(() => {
    replaceMock.mockClear();
    getCurrentUserMock.mockReset();
    refreshSessionMock.mockReset();
  });

  it('começa checando a sessão', () => {
    getCurrentUserMock.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useRequireAuth());

    expect(result.current.isChecking).toBe(true);
  });

  it('para de checar quando a sessão é válida', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1' } });

    const { result } = renderHook(() => useRequireAuth());

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('redireciona pra /entrar quando a sessão não vale mais (401 — o apiFetch já tenta renovar sozinho antes disso)', async () => {
    getCurrentUserMock.mockRejectedValue(new ApiError(401, 'Sessão inválida ou expirada.'));

    renderHook(() => useRequireAuth());

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/entrar'));
  });

  it('não desloga em erro de rede', async () => {
    getCurrentUserMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const { result } = renderHook(() => useRequireAuth());

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('renova a sessão proativamente a cada 10 minutos enquanto o app fica aberto, e para no unmount', async () => {
    vi.useFakeTimers();
    try {
      getCurrentUserMock.mockResolvedValue({ user: { id: '1' } });
      refreshSessionMock.mockResolvedValue({ success: true });

      const { result, unmount } = renderHook(() => useRequireAuth());
      await vi.waitFor(() => expect(result.current.isChecking).toBe(false));
      expect(refreshSessionMock).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(10 * 60_000);
      expect(refreshSessionMock).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(10 * 60_000);
      expect(refreshSessionMock).toHaveBeenCalledTimes(2);

      unmount();
      await vi.advanceTimersByTimeAsync(10 * 60_000);
      expect(refreshSessionMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
