import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EscalasPage from './page';

const listSkillCategoriesMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    listSkillCategories: (...args: unknown[]) => listSkillCategoriesMock(...args),
  };
});

const listMyJobsMock = vi.fn();
const cancelJobMock = vi.fn();
vi.mock('../../../lib/jobs-api', () => ({
  listMyJobs: (...args: unknown[]) => listMyJobsMock(...args),
  cancelJob: (...args: unknown[]) => cancelJobMock(...args),
}));

const listJobApplicationsMock = vi.fn();
vi.mock('../../../lib/applications-api', () => ({
  listJobApplications: (...args: unknown[]) => listJobApplicationsMock(...args),
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
  startsAt: '2026-08-06T18:00:00.000Z',
  endsAt: '2026-08-06T23:00:00.000Z',
  status: 'open',
};

describe('EscalasPage', () => {
  beforeEach(() => {
    listSkillCategoriesMock.mockReset().mockResolvedValue({ categories: [{ id: 'cat-1', name: 'Garçom' }] });
    listMyJobsMock.mockReset();
    cancelJobMock.mockReset();
    listJobApplicationsMock.mockReset().mockResolvedValue({ applications: [] });
  });

  it('mostra estado vazio quando não há escala aberta', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [] });

    render(<EscalasPage />);

    expect(await screen.findByText(/nenhuma escala em aberto/i)).toBeInTheDocument();
  });

  it('mostra a escala aberta com categoria, horário e candidatos pendentes', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });
    listJobApplicationsMock.mockResolvedValue({
      applications: [
        {
          id: 'app-1',
          status: 'pending',
          createdAt: '2026-08-01T00:00:00.000Z',
          worker: { id: 'w1', fullName: 'Ana Souza', photoUrl: null, avgRating: null },
          shift: null,
        },
      ],
    });

    render(<EscalasPage />);

    expect(await screen.findByText(/Garçom · 3 vaga\(s\)/)).toBeInTheDocument();
    expect(screen.getByText(/R\$ 130.00 por pessoa/)).toBeInTheDocument();
    expect(screen.getByText('1 candidatos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver candidatos/i })).toHaveAttribute('href', '/vagas/job-1');
  });

  it('não lista escala preenchida ou cancelada', async () => {
    listMyJobsMock.mockResolvedValue({
      jobs: [JOB, { ...JOB, id: 'job-2', status: 'filled' }, { ...JOB, id: 'job-3', status: 'cancelled' }],
    });

    render(<EscalasPage />);

    await screen.findByText(/Garçom/);
    expect(screen.getAllByText(/Garçom/)).toHaveLength(1);
  });

  it('mostra escala aberta mesmo que o horário de início já tenha passado', async () => {
    const pastJob = { ...JOB, id: 'job-past', startsAt: '2020-01-01T18:00:00.000Z', endsAt: '2020-01-01T23:00:00.000Z' };
    listMyJobsMock.mockResolvedValue({ jobs: [pastJob] });

    render(<EscalasPage />);

    expect(await screen.findByText(/Garçom/)).toBeInTheDocument();
  });

  it('cancela a escala e some da lista', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });
    cancelJobMock.mockResolvedValue({ ...JOB, status: 'cancelled' });
    const user = userEvent.setup();

    render(<EscalasPage />);
    await screen.findByText(/Garçom/);
    await user.click(screen.getByRole('button', { name: /cancelar escala/i }));

    await waitFor(() => expect(cancelJobMock).toHaveBeenCalledWith('job-1'));
    expect(await screen.findByText(/nenhuma escala em aberto/i)).toBeInTheDocument();
  });

  it('mostra a mensagem da API quando o cancelamento falha', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });
    cancelJobMock.mockRejectedValue(new Error('falha de rede'));
    const user = userEvent.setup();

    render(<EscalasPage />);
    await screen.findByText(/Garçom/);
    await user.click(screen.getByRole('button', { name: /cancelar escala/i }));

    expect(await screen.findByText('Não foi possível cancelar a escala.')).toBeInTheDocument();
  });

  it('mostra mensagem de erro quando a listagem falha', async () => {
    listMyJobsMock.mockRejectedValue(new Error('falha'));

    render(<EscalasPage />);

    expect(await screen.findByText('Não foi possível carregar suas escalas.')).toBeInTheDocument();
  });
});
