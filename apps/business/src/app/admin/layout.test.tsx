import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from './layout';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: pushMock }),
}));

const useRequireAuthMock = vi.fn();
vi.mock('../../hooks/use-require-auth', () => ({
  useRequireAuth: (...args: unknown[]) => useRequireAuthMock(...args),
}));

const getCurrentUserMock = vi.fn();
const logoutMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
    logout: (...args: unknown[]) => logoutMock(...args),
  };
});

describe('AdminLayout', () => {
  beforeEach(() => {
    pushMock.mockClear();
    useRequireAuthMock.mockReset().mockReturnValue({ isChecking: false });
    getCurrentUserMock.mockReset();
    logoutMock.mockReset().mockResolvedValue({ message: 'ok' });
  });

  it('mostra acesso restrito pra quem não é admin, sem exigir perfil de empresa', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: false } });

    render(
      <AdminLayout>
        <p>conteúdo</p>
      </AdminLayout>,
    );

    expect(await screen.findByText('Essa área é restrita a administradores.')).toBeInTheDocument();
    expect(screen.queryByText('conteúdo')).not.toBeInTheDocument();
  });

  it('renderiza a nav e o conteúdo pro admin', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: true } });

    render(
      <AdminLayout>
        <p>conteúdo</p>
      </AdminLayout>,
    );

    expect(await screen.findByText('conteúdo')).toBeInTheDocument();
    expect(screen.getByText('Empresas')).toBeInTheDocument();
    expect(screen.getByText('Trabalhadores')).toBeInTheDocument();
  });

  it('desloga e manda pro login', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: true } });
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <AdminLayout>
        <p>conteúdo</p>
      </AdminLayout>,
    );
    await screen.findByText('conteúdo');
    await user.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(logoutMock).toHaveBeenCalled());
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/entrar'));
  });
});
