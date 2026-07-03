import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PainelPage from './page';

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

describe('PainelPage', () => {
  beforeEach(() => {
    replaceMock.mockClear();
    getCurrentUserMock.mockReset();
    refreshSessionMock.mockReset();
  });

  it('mostra uma mensagem de confirmação antes de checar a sessão', () => {
    getCurrentUserMock.mockReturnValue(new Promise(() => {}));

    render(<PainelPage />);

    expect(screen.getByText('Confirmando sua sessão...')).toBeInTheDocument();
  });

  it('mostra o conteúdo quando a sessão já é válida', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1' } });

    render(<PainelPage />);

    expect(await screen.findByText(/login confirmado/i)).toBeInTheDocument();
    expect(refreshSessionMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('renova a sessão quando o access token expirou e mostra o conteúdo', async () => {
    getCurrentUserMock.mockRejectedValueOnce(new Error('401')).mockResolvedValueOnce({
      user: { id: '1' },
    });
    refreshSessionMock.mockResolvedValue({ success: true });

    render(<PainelPage />);

    expect(await screen.findByText(/login confirmado/i)).toBeInTheDocument();
    expect(refreshSessionMock).toHaveBeenCalled();
    expect(getCurrentUserMock).toHaveBeenCalledTimes(2);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('redireciona pra /entrar quando não há sessão válida', async () => {
    getCurrentUserMock.mockRejectedValue(new Error('401'));
    refreshSessionMock.mockRejectedValue(new Error('sem refresh token'));

    render(<PainelPage />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/entrar'));
    expect(screen.queryByText(/login confirmado/i)).not.toBeInTheDocument();
  });
});
