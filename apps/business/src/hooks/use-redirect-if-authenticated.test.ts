import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRedirectIfAuthenticated } from './use-redirect-if-authenticated';

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

describe('useRedirectIfAuthenticated', () => {
  beforeEach(() => {
    replaceMock.mockClear();
    getCurrentUserMock.mockReset();
    refreshSessionMock.mockReset();
  });

  it('começa checando a sessão', () => {
    getCurrentUserMock.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useRedirectIfAuthenticated('/painel'));

    expect(result.current.isChecking).toBe(true);
  });

  it('redireciona quando já existe sessão válida', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1' } });

    renderHook(() => useRedirectIfAuthenticated('/painel'));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/painel'));
    expect(refreshSessionMock).not.toHaveBeenCalled();
  });

  it('renova a sessão expirada antes de redirecionar', async () => {
    getCurrentUserMock.mockRejectedValueOnce(new Error('401')).mockResolvedValueOnce({
      user: { id: '1' },
    });
    refreshSessionMock.mockResolvedValue({ success: true });

    renderHook(() => useRedirectIfAuthenticated('/painel'));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/painel'));
    expect(refreshSessionMock).toHaveBeenCalled();
  });

  it('para de checar sem redirecionar quando não há sessão', async () => {
    getCurrentUserMock.mockRejectedValue(new Error('401'));
    refreshSessionMock.mockRejectedValue(new Error('sem refresh token'));

    const { result } = renderHook(() => useRedirectIfAuthenticated('/painel'));

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
