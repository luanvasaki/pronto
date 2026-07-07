import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PerfilPage from './page';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

const listSkillCategoriesMock = vi.fn();
const logoutMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    listSkillCategories: (...args: unknown[]) => listSkillCategoriesMock(...args),
    logout: (...args: unknown[]) => logoutMock(...args),
  };
});

const getWorkerProfileMock = vi.fn();
vi.mock('../../../lib/worker-profile-api', () => ({
  getWorkerProfile: (...args: unknown[]) => getWorkerProfileMock(...args),
}));

describe('PerfilPage', () => {
  beforeEach(() => {
    pushMock.mockClear();
    listSkillCategoriesMock.mockReset().mockResolvedValue({ categories: [{ id: 'cat-1', name: 'Garçom' }] });
    getWorkerProfileMock.mockReset();
    logoutMock.mockReset().mockResolvedValue({ message: 'ok' });
  });

  it('mostra nome, categorias e estatísticas', async () => {
    getWorkerProfileMock.mockResolvedValue({
      fullName: 'Ana Souza',
      categoryIds: ['cat-1'],
      kycStatus: 'approved',
      avgRating: '4.5',
      totalShiftsCompleted: 3,
      totalNoShows: 1,
    });

    render(<PerfilPage />);

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('Identidade verificada')).toBeInTheDocument();
    expect(screen.getByText('Garçom')).toBeInTheDocument();
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('mostra travessão quando ainda não tem nota', async () => {
    getWorkerProfileMock.mockResolvedValue({
      fullName: 'Ana Souza',
      categoryIds: [],
      kycStatus: 'pending',
      avgRating: null,
      totalShiftsCompleted: 0,
      totalNoShows: 0,
    });

    render(<PerfilPage />);

    await screen.findByText('Ana Souza');
    expect(screen.getByText('Documento em análise')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('mostra mensagem de erro quando a chamada falha', async () => {
    getWorkerProfileMock.mockRejectedValue(new Error('falhou'));

    render(<PerfilPage />);

    expect(await screen.findByText('Não foi possível carregar seu perfil.')).toBeInTheDocument();
  });

  it('chama logout e navega pro login ao clicar em "Sair da conta"', async () => {
    getWorkerProfileMock.mockResolvedValue({
      fullName: 'Ana Souza',
      categoryIds: [],
      kycStatus: 'approved',
      avgRating: '4.5',
      totalShiftsCompleted: 3,
      totalNoShows: 0,
    });
    const user = userEvent.setup();
    render(<PerfilPage />);

    const logoutButton = await screen.findByRole('button', { name: /sair da conta/i });
    await user.click(logoutButton);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/entrar'));
    expect(logoutMock).toHaveBeenCalled();
  });
});
