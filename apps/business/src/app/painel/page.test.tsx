import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PainelPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const listSkillCategoriesMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    getCurrentUser: vi.fn().mockResolvedValue({ user: { id: '1' } }),
    listSkillCategories: (...args: unknown[]) => listSkillCategoriesMock(...args),
  };
});

const listMyJobsMock = vi.fn();
vi.mock('../../lib/jobs-api', () => ({
  listMyJobs: (...args: unknown[]) => listMyJobsMock(...args),
}));

const JOB = {
  id: 'job-1',
  categoryId: 'cat-1',
  description: 'Vaga de garçom pra evento',
  addressLabel: 'Vila Madalena, São Paulo',
  locationLat: -23.55,
  locationLng: -46.63,
  positionsTotal: 4,
  positionsFilled: 1,
  payAmount: '130.00',
  startsAt: '2026-08-01T18:00:00.000Z',
  endsAt: '2026-08-01T23:00:00.000Z',
  status: 'open',
};

describe('PainelPage', () => {
  beforeEach(() => {
    listSkillCategoriesMock.mockReset().mockResolvedValue({ categories: [{ id: 'cat-1', name: 'Garçom' }] });
    listMyJobsMock.mockReset();
  });

  it('mostra estado vazio quando não há vagas', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [] });

    render(<PainelPage />);

    expect(await screen.findByText('Você ainda não publicou nenhuma vaga.')).toBeInTheDocument();
  });

  it('lista as vagas com categoria e status', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });

    render(<PainelPage />);

    expect(await screen.findByText('Garçom')).toBeInTheDocument();
    expect(screen.getByText('Vila Madalena, São Paulo')).toBeInTheDocument();
    expect(screen.getByText('Aberta')).toBeInTheDocument();
    expect(screen.getByText(/1\/4 preenchidas/)).toBeInTheDocument();
  });

  it('mostra link pra publicar vaga', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [] });

    render(<PainelPage />);

    expect(await screen.findByRole('link', { name: /publicar vaga/i })).toHaveAttribute(
      'href',
      '/vagas/nova',
    );
  });

  it('mostra mensagem de erro quando a listagem falha', async () => {
    listMyJobsMock.mockRejectedValue(new Error('falha'));

    render(<PainelPage />);

    expect(await screen.findByText('Não foi possível carregar suas vagas.')).toBeInTheDocument();
  });
});
