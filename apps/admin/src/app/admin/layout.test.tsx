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

const listPendingVerificationsMock = vi.fn();
vi.mock('../../lib/admin-api', () => ({
  listPendingVerifications: (...args: unknown[]) => listPendingVerificationsMock(...args),
}));

const EMPTY_VERIFICATIONS = { documents: [], companies: [], skillCategories: [] };

describe('AdminLayout', () => {
  beforeEach(() => {
    pushMock.mockClear();
    useRequireAuthMock.mockReset().mockReturnValue({ isChecking: false });
    getCurrentUserMock.mockReset();
    logoutMock.mockReset().mockResolvedValue({ message: 'ok' });
    listPendingVerificationsMock.mockReset().mockResolvedValue(EMPTY_VERIFICATIONS);
  });

  it('mostra acesso restrito pra quem não é admin, sem exigir perfil de empresa', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: false, email: 'admin@pronto.work' } });

    render(
      <AdminLayout>
        <p>conteúdo</p>
      </AdminLayout>,
    );

    expect(await screen.findByText('Essa área é restrita a administradores.')).toBeInTheDocument();
    expect(screen.queryByText('conteúdo')).not.toBeInTheDocument();
  });

  it('renderiza a nav e o conteúdo pro admin', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: true, email: 'admin@pronto.work' } });

    render(
      <AdminLayout>
        <p>conteúdo</p>
      </AdminLayout>,
    );

    expect(await screen.findByText('conteúdo')).toBeInTheDocument();
    expect(screen.getByText('Empresas')).toBeInTheDocument();
    expect(screen.getByText('Trabalhadores')).toBeInTheDocument();
  });

  it('não mostra contador no sino nem no menu quando não há nada pendente', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: true, email: 'admin@pronto.work' } });
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <AdminLayout>
        <p>conteúdo</p>
      </AdminLayout>,
    );

    await screen.findByText('conteúdo');
    const bell = screen.getByRole('button', { name: 'Verificações pendentes' });
    await user.click(bell);

    expect(await screen.findByText('Nenhuma verificação pendente.')).toBeInTheDocument();
  });

  it('mostra a soma de trabalhadores, empresas e categorias pendentes no sino, no menu e no dropdown', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: true, email: 'admin@pronto.work' } });
    listPendingVerificationsMock.mockResolvedValue({
      documents: [
        { id: 'doc-1', workerId: 'worker-1', workerFullName: 'Ana', type: 'identity', createdAt: new Date() },
        { id: 'doc-2', workerId: 'worker-1', workerFullName: 'Ana', type: 'selfie', createdAt: new Date() },
        { id: 'doc-3', workerId: 'worker-2', workerFullName: 'Beto', type: 'identity', createdAt: new Date() },
      ],
      companies: [
        {
          id: 'company-1',
          legalName: 'Bar do Zé Ltda',
          tradeName: 'Bar do Zé',
          personType: 'juridica',
          cnpj: '1',
          cpf: null,
          documentId: null,
        },
      ],
      skillCategories: [{ id: 'cat-1', name: 'Barista', createdByName: null }],
    });
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <AdminLayout>
        <p>conteúdo</p>
      </AdminLayout>,
    );

    // 2 trabalhadores (identidade+selfie da Ana contam como 1) + 1 empresa + 1 categoria = 4.
    const bell = await screen.findByLabelText('4 verificação(ões) pendente(s)');
    // Aparece duas vezes: badge no sino e badge no item "Verificações" do menu.
    expect(screen.getAllByText('4')).toHaveLength(2);

    await user.click(bell);

    expect(screen.getByText('Ana', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Beto', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Bar do Zé', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Barista', { exact: false })).toBeInTheDocument();
    // 2 trabalhadores (Ana + Beto) + 1 empresa + 1 categoria = 4 itens no dropdown.
    const dropdownLinks = screen.getAllByRole('link', { name: /aguardando/i });
    expect(dropdownLinks).toHaveLength(4);
    for (const link of dropdownLinks) {
      expect(link).toHaveAttribute('href', '/admin/verificacoes');
    }
  });

  it('desloga e manda pro login', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: true, email: 'admin@pronto.work' } });
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
