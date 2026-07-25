import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRedirectIfAuthenticated } from './use-redirect-if-authenticated';

const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

const getCurrentUserMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
  };
});

describe('useRedirectIfAuthenticated', () => {
  beforeEach(() => {
    replaceMock.mockClear();
    getCurrentUserMock.mockReset();
  });

  it('começa checando a sessão', () => {
    getCurrentUserMock.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useRedirectIfAuthenticated('/inicio'));

    expect(result.current.isChecking).toBe(true);
  });

  it('redireciona quando já existe sessão válida (o apiFetch já tenta renovar sozinho num 401)', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1' } });

    renderHook(() => useRedirectIfAuthenticated('/inicio'));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/inicio'));
  });

  it('para de checar sem redirecionar quando não há sessão', async () => {
    getCurrentUserMock.mockRejectedValue(new Error('401'));

    const { result } = renderHook(() => useRedirectIfAuthenticated('/inicio'));

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
