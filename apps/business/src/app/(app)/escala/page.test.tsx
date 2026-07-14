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
const duplicateWeekMock = vi.fn();
vi.mock('../../../lib/jobs-api', () => ({
  listMyJobs: (...args: unknown[]) => listMyJobsMock(...args),
  duplicateWeek: (...args: unknown[]) => duplicateWeekMock(...args),
}));

const listJobApplicationsMock = vi.fn();
vi.mock('../../../lib/applications-api', () => ({
  listJobApplications: (...args: unknown[]) => listJobApplicationsMock(...args),
}));

const getLiveEventStatusMock = vi.fn();
vi.mock('../../../lib/live-event-api', () => ({
  getLiveEventStatus: (...args: unknown[]) => getLiveEventStatusMock(...args),
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
    duplicateWeekMock.mockReset();
    getLiveEventStatusMock.mockReset().mockResolvedValue({ jobs: [] });
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

    const addLink = await screen.findByRole('link', { name: 'Publicar escala em 2026-08-06' });
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

    expect(await screen.findByText('Não foi possível carregar suas escalas.')).toBeInTheDocument();
  });

  it('alterna pra visão semanal e mostra o turno com posições preenchidas/total', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });
    const user = userEvent.setup();

    render(<EscalaPage />);
    await screen.findByText('Agosto de 2026');

    await user.click(screen.getByRole('button', { name: 'Semana' }));

    expect(await screen.findByRole('button', { name: 'Duplicar semana' })).toBeInTheDocument();
    expect(screen.getByText('1/4')).toBeInTheDocument();
  });

  it('exige o checkbox de termos marcado antes de habilitar "Confirmar duplicação"', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });
    const user = userEvent.setup();

    render(<EscalaPage />);
    await screen.findByText('Agosto de 2026');
    await user.click(screen.getByRole('button', { name: 'Semana' }));
    await user.click(await screen.findByRole('button', { name: 'Duplicar semana' }));

    const confirmButton = await screen.findByRole('button', { name: 'Confirmar duplicação' });
    expect(confirmButton).toBeDisabled();

    await user.click(screen.getByRole('checkbox'));
    expect(confirmButton).toBeEnabled();
  });

  it('reseta o checkbox de termos ao cancelar, mesmo tendo marcado antes', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });
    const user = userEvent.setup();

    render(<EscalaPage />);
    await screen.findByText('Agosto de 2026');
    await user.click(screen.getByRole('button', { name: 'Semana' }));
    await user.click(await screen.findByRole('button', { name: 'Duplicar semana' }));
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await user.click(screen.getByRole('button', { name: 'Duplicar semana' }));
    expect(await screen.findByRole('checkbox')).not.toBeChecked();
  });

  it('alterna pra visão "Ao vivo" e esconde a grade de mês/semana', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });
    const user = userEvent.setup();

    render(<EscalaPage />);
    await screen.findByText('Agosto de 2026');

    await user.click(screen.getByRole('button', { name: 'Ao vivo' }));

    expect(await screen.findByRole('heading', { name: 'Ao vivo' })).toBeInTheDocument();
    expect(getLiveEventStatusMock).toHaveBeenCalled();
    // Cabeçalho de dias da semana da grade de mês some da tela nessa visão.
    expect(screen.queryByText('Seg')).not.toBeInTheDocument();
  });

  it('duplica a semana e mostra mensagem de sucesso, sem recarregar o histórico inteiro', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });
    duplicateWeekMock.mockResolvedValue({ jobs: [{ ...JOB, id: 'job-2', startsAt: '2026-08-13T12:00:00.000Z', endsAt: '2026-08-13T18:00:00.000Z', positionsFilled: 0 }] });
    const user = userEvent.setup();

    render(<EscalaPage />);
    await screen.findByText('Agosto de 2026');
    await user.click(screen.getByRole('button', { name: 'Semana' }));
    await user.click(await screen.findByRole('button', { name: 'Duplicar semana' }));
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Confirmar duplicação' }));

    expect(await screen.findByText('1 escala duplicada pra semana seguinte.')).toBeInTheDocument();
    // Uma única chamada de listMyJobs (carga inicial) — duplicar não recarrega o histórico inteiro.
    expect(listMyJobsMock).toHaveBeenCalledTimes(1);
  });

  it('mostra erro e não fecha o formulário quando duplicar a semana falha', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });
    duplicateWeekMock.mockRejectedValue(new Error('Não foi possível duplicar a semana.'));
    const user = userEvent.setup();

    render(<EscalaPage />);
    await screen.findByText('Agosto de 2026');
    await user.click(screen.getByRole('button', { name: 'Semana' }));
    await user.click(await screen.findByRole('button', { name: 'Duplicar semana' }));
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Confirmar duplicação' }));

    expect(await screen.findByText('Não foi possível duplicar a semana.')).toBeInTheDocument();
    expect(screen.queryByText(/escala duplicada pra semana seguinte/)).not.toBeInTheDocument();
  });
});
