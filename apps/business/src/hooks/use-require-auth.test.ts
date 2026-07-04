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

  it('para de checar quando a sessão já é válida', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1' } });

    const { result } = renderHook(() => useRequireAuth());

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(refreshSessionMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('renova a sessão quando o access token expirou', async () => {
    getCurrentUserMock.mockRejectedValueOnce(new Error('401')).mockResolvedValueOnce({
      user: { id: '1' },
    });
    refreshSessionMock.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useRequireAuth());

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(refreshSessionMock).toHaveBeenCalled();
    expect(getCurrentUserMock).toHaveBeenCalledTimes(2);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('redireciona pra /entrar quando não há sessão válida', async () => {
    getCurrentUserMock.mockRejectedValue(new Error('401'));
    refreshSessionMock.mockRejectedValue(new Error('sem refresh token'));

    renderHook(() => useRequireAuth());

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/entrar'));
  });
});
