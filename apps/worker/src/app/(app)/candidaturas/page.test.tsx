import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CandidaturasPage from './page';

const listSkillCategoriesMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    listSkillCategories: (...args: unknown[]) => listSkillCategoriesMock(...args),
  };
});

const listMyApplicationsMock = vi.fn();
const withdrawApplicationMock = vi.fn();
vi.mock('../../../lib/applications-api', () => ({
  listMyApplications: (...args: unknown[]) => listMyApplicationsMock(...args),
  withdrawApplication: (...args: unknown[]) => withdrawApplicationMock(...args),
}));

const APPLICATION = {
  id: 'app-1',
  status: 'pending',
  removedAt: null,
  workerSeenRemovalAt: null,
  createdAt: '2026-07-01T12:00:00.000Z',
  companyName: 'Buffet Aurora',
  job: {
    id: 'job-1',
    categoryId: 'cat-1',
    description: 'Vaga de garçom pra evento grande',
    addressLabel: 'Vila Madalena, São Paulo',
    locationLat: -23.55,
    locationLng: -46.63,
    positionsTotal: 4,
    positionsFilled: 1,
    payAmount: '130.00',
    startsAt: '2026-08-01T18:00:00.000Z',
    endsAt: '2026-08-01T23:00:00.000Z',
    status: 'open',
  },
};

describe('CandidaturasPage', () => {
  beforeEach(() => {
    listSkillCategoriesMock.mockReset().mockResolvedValue({ categories: [{ id: 'cat-1', name: 'Garçom' }] });
    listMyApplicationsMock.mockReset();
    withdrawApplicationMock.mockReset();
  });

  it('mostra estado vazio quando não há candidaturas', async () => {
    listMyApplicationsMock.mockResolvedValue({ applications: [] });

    render(<CandidaturasPage />);

    expect(
      await screen.findByText('Você ainda não se candidatou a nenhuma vaga.'),
    ).toBeInTheDocument();
  });

  it('lista as candidaturas com categoria e status', async () => {
    listMyApplicationsMock.mockResolvedValue({ applications: [APPLICATION] });

    render(<CandidaturasPage />);

    expect(await screen.findByText('Garçom')).toBeInTheDocument();
    expect(screen.getByText('Buffet Aurora')).toBeInTheDocument();
    expect(screen.getByText('Em análise')).toBeInTheDocument();
    expect(screen.getByText('Vila Madalena, São Paulo')).toBeInTheDocument();
    expect(screen.getByText('R$ 130.00')).toBeInTheDocument();
  });

  it('mostra rótulo "Aprovada" pra candidatura aprovada', async () => {
    listMyApplicationsMock.mockResolvedValue({
      applications: [{ ...APPLICATION, status: 'approved' }],
    });

    render(<CandidaturasPage />);

    expect(await screen.findByText('Aprovada')).toBeInTheDocument();
  });

  it('mostra rótulo "Rejeitada" pra candidatura que nunca foi aceita', async () => {
    listMyApplicationsMock.mockResolvedValue({
      applications: [{ ...APPLICATION, status: 'rejected', removedAt: null }],
    });

    render(<CandidaturasPage />);

    expect(await screen.findByText('Rejeitada')).toBeInTheDocument();
  });

  it('mostra rótulo "Removida" (mais grave) quando a empresa aceitou e depois removeu o trabalhador', async () => {
    listMyApplicationsMock.mockResolvedValue({
      applications: [
        {
          ...APPLICATION,
          status: 'rejected',
          removedAt: '2026-07-05T12:00:00.000Z',
          workerSeenRemovalAt: null,
        },
      ],
    });

    render(<CandidaturasPage />);

    expect(await screen.findByText('Removida')).toBeInTheDocument();
    expect(screen.queryByText('Rejeitada')).not.toBeInTheDocument();
  });

  it('mostra mensagem de erro quando a listagem falha', async () => {
    listMyApplicationsMock.mockRejectedValue(new Error('falha'));

    render(<CandidaturasPage />);

    expect(
      await screen.findByText('Não foi possível carregar suas candidaturas.'),
    ).toBeInTheDocument();
  });

  it('não mostra botão de cancelar pra candidatura aprovada', async () => {
    listMyApplicationsMock.mockResolvedValue({
      applications: [{ ...APPLICATION, status: 'approved' }],
    });

    render(<CandidaturasPage />);

    await screen.findByText('Aprovada');
    expect(screen.queryByRole('button', { name: 'Cancelar candidatura' })).not.toBeInTheDocument();
  });

  it('cancela uma candidatura pendente após confirmar', async () => {
    const user = userEvent.setup();
    listMyApplicationsMock.mockResolvedValue({ applications: [APPLICATION] });
    withdrawApplicationMock.mockResolvedValue({ id: 'app-1', status: 'withdrawn' });

    render(<CandidaturasPage />);

    await user.click(await screen.findByRole('button', { name: 'Cancelar candidatura' }));
    expect(screen.getByRole('button', { name: 'Confirmar cancelamento' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }));

    await waitFor(() => expect(withdrawApplicationMock).toHaveBeenCalledWith('app-1'));
    expect(await screen.findByText('Retirada')).toBeInTheDocument();
  });

  it('mostra erro quando o cancelamento falha', async () => {
    const user = userEvent.setup();
    listMyApplicationsMock.mockResolvedValue({ applications: [APPLICATION] });
    withdrawApplicationMock.mockRejectedValue(new Error('falha'));

    render(<CandidaturasPage />);

    await user.click(await screen.findByRole('button', { name: 'Cancelar candidatura' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }));

    expect(await screen.findByText('Não foi possível cancelar a candidatura.')).toBeInTheDocument();
  });
});
