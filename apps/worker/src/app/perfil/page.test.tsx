import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PerfilPage from './page';

const listSkillCategoriesMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    listSkillCategories: (...args: unknown[]) => listSkillCategoriesMock(...args),
  };
});

const getWorkerProfileMock = vi.fn();
vi.mock('../../lib/worker-profile-api', () => ({
  getWorkerProfile: (...args: unknown[]) => getWorkerProfileMock(...args),
}));

describe('PerfilPage', () => {
  beforeEach(() => {
    listSkillCategoriesMock.mockReset().mockResolvedValue({ categories: [{ id: 'cat-1', name: 'Garçom' }] });
    getWorkerProfileMock.mockReset();
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
});
