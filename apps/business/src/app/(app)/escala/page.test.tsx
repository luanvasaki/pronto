import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EscalaPage from './page';

const listSkillCategoriesMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    listSkillCategories: (...args: unknown[]) => listSkillCategoriesMock(...args),
  };
});

const listMyJobsMock = vi.fn();
vi.mock('../../../lib/jobs-api', () => ({
  listMyJobs: (...args: unknown[]) => listMyJobsMock(...args),
}));

const listJobApplicationsMock = vi.fn();
vi.mock('../../../lib/applications-api', () => ({
  listJobApplications: (...args: unknown[]) => listJobApplicationsMock(...args),
}));

// Quinta-feira, meio-dia UTC — evita qualquer ambiguidade de fuso horário
// no cálculo do dia do mês.
const NOW = new Date('2026-08-06T12:00:00.000Z');

const JOB = {
  id: 'job-1',
  categoryId: 'cat-1',
  description: 'Vaga de garçom pra evento',
  requiresExperience: false,
  dressCode: null,
  toolsRequired: null,
  addressLabel: 'Vila Madalena, São Paulo',
  locationLat: -23.55,
  locationLng: -46.63,
  positionsTotal: 4,
  positionsFilled: 1,
  payAmount: '130.00',
  startsAt: '2026-08-06T12:00:00.000Z',
  endsAt: '2026-08-06T18:00:00.000Z',
  status: 'open',
};

describe('EscalaPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
    listSkillCategoriesMock.mockReset().mockResolvedValue({ categories: [{ id: 'cat-1', name: 'Garçom' }] });
    listMyJobsMock.mockReset();
    listJobApplicationsMock.mockReset().mockResolvedValue({ applications: [] });
  });

  it('mostra o mês atual', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [] });

    render(<EscalaPage />);

    expect(await screen.findByText('Agosto de 2026')).toBeInTheDocument();
  });

  it('mostra o turno no dia certo, com link pros candidatos', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });

    render(<EscalaPage />);

    const jobLink = await screen.findByRole('link', { name: 'Garçom' });
    expect(jobLink).toHaveAttribute('href', '/vagas/job-1');
  });

  it('mostra quem trabalhou (candidaturas aprovadas) no dia', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });
    listJobApplicationsMock.mockResolvedValue({
      applications: [
        { id: 'app-1', status: 'approved', worker: { fullName: 'Ana Souza' } },
        { id: 'app-2', status: 'pending', worker: { fullName: 'Beatriz Lima' } },
      ],
    });

    render(<EscalaPage />);

    expect(await screen.findByText('👤 Ana Souza')).toBeInTheDocument();
    expect(screen.queryByText(/Beatriz Lima/)).not.toBeInTheDocument();
  });

  it('não mostra nada de "quem trabalhou" quando não há candidatura aprovada', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });
    listJobApplicationsMock.mockResolvedValue({
      applications: [{ id: 'app-1', status: 'pending', worker: { fullName: 'Ana Souza' } }],
    });

    render(<EscalaPage />);

    await screen.findByRole('link', { name: 'Garçom' });
    expect(screen.queryByText(/👤/)).not.toBeInTheDocument();
  });

  it('mostra o botão de publicar turno em cada dia, com a data certa', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [] });

    render(<EscalaPage />);

    const addLink = await screen.findByRole('link', { name: 'Publicar turno em 2026-08-06' });
    expect(addLink).toHaveAttribute('href', '/vagas/nova?data=2026-08-06');
  });

  it('mostra "+N" quando há mais turnos no dia do que cabe mostrar', async () => {
    listMyJobsMock.mockResolvedValue({
      jobs: [
        JOB,
        { ...JOB, id: 'job-2' },
        { ...JOB, id: 'job-3' },
        { ...JOB, id: 'job-4' },
      ],
    });

    render(<EscalaPage />);

    expect(await screen.findByText('+1')).toBeInTheDocument();
  });

  it('navega pro mês seguinte e volta', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [] });
    const user = userEvent.setup();

    render(<EscalaPage />);
    await screen.findByText('Agosto de 2026');

    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));
    expect(await screen.findByText('Setembro de 2026')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mês anterior' }));
    expect(await screen.findByText('Agosto de 2026')).toBeInTheDocument();
  });

  it('mostra erro quando não consegue carregar', async () => {
    listMyJobsMock.mockRejectedValue(new Error('falha'));

    render(<EscalaPage />);

    expect(await screen.findByText('Não foi possível carregar seus turnos.')).toBeInTheDocument();
  });
});
