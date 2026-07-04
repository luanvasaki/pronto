import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
const cancelJobMock = vi.fn();
vi.mock('../../lib/jobs-api', () => ({
  listMyJobs: (...args: unknown[]) => listMyJobsMock(...args),
  cancelJob: (...args: unknown[]) => cancelJobMock(...args),
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
    cancelJobMock.mockReset();
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

  it('mostra link de editar só pra vaga aberta', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB, { ...JOB, id: 'job-2', status: 'filled' }] });

    render(<PainelPage />);

    await screen.findAllByText('Garçom');
    expect(screen.getAllByRole('link', { name: /editar/i })).toHaveLength(1);
  });

  it('cancela a vaga e atualiza o status na tela', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });
    cancelJobMock.mockResolvedValue({ ...JOB, status: 'cancelled' });
    const user = userEvent.setup();

    render(<PainelPage />);
    await screen.findByText('Garçom');
    await user.click(screen.getByRole('button', { name: /cancelar vaga/i }));

    await waitFor(() => expect(cancelJobMock).toHaveBeenCalledWith('job-1'));
    expect(await screen.findByText('Cancelada')).toBeInTheDocument();
  });

  it('mostra a mensagem da API quando o cancelamento falha', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });
    cancelJobMock.mockRejectedValue(new Error('falha de rede'));
    const user = userEvent.setup();

    render(<PainelPage />);
    await screen.findByText('Garçom');
    await user.click(screen.getByRole('button', { name: /cancelar vaga/i }));

    expect(await screen.findByText('Não foi possível cancelar a vaga.')).toBeInTheDocument();
  });
});
