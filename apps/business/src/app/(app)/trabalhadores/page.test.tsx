import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TrabalhadoresPage from './page';

const getCompanyWorkerHistoryMock = vi.fn();
vi.mock('../../../lib/workers-api', () => ({
  getCompanyWorkerHistory: (...args: unknown[]) => getCompanyWorkerHistoryMock(...args),
}));

const NOW = new Date('2026-07-14T15:00:00.000Z');

function makeWorker(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    workerId: 'worker-1',
    fullName: 'Ana Souza',
    photoUrl: null,
    shiftsCompleted: 5,
    noShowCount: 0,
    attendanceRate: 100,
    avgRatingGiven: '4.8',
    lastWorkedAt: '2026-07-13T12:00:00.000Z',
    ...overrides,
  };
}

describe('TrabalhadoresPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
    getCompanyWorkerHistoryMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra "Carregando" enquanto busca o histórico', () => {
    getCompanyWorkerHistoryMock.mockReturnValue(new Promise(() => {}));

    render(<TrabalhadoresPage />);

    expect(screen.getByText('Carregando seu histórico...')).toBeInTheDocument();
  });

  it('mostra estado vazio quando não há histórico', async () => {
    getCompanyWorkerHistoryMock.mockResolvedValue({ workers: [] });

    render(<TrabalhadoresPage />);

    expect(await screen.findByText('Ainda sem histórico')).toBeInTheDocument();
  });

  it('mostra erro quando a busca falha', async () => {
    getCompanyWorkerHistoryMock.mockRejectedValue(new Error('falha'));

    render(<TrabalhadoresPage />);

    expect(await screen.findByText('Não foi possível carregar seu histórico de trabalhadores.')).toBeInTheDocument();
  });

  it('mostra nome, turnos concluídos, comparecimento, nota dada e última vez que trabalhou', async () => {
    getCompanyWorkerHistoryMock.mockResolvedValue({
      workers: [
        makeWorker({
          fullName: 'Ana Souza',
          shiftsCompleted: 8,
          attendanceRate: 95,
          avgRatingGiven: '4.9',
          lastWorkedAt: '2026-07-13T12:00:00.000Z',
        }),
      ],
    });

    render(<TrabalhadoresPage />);

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('8 concluído(s)')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.getByText('★ 4.9')).toBeInTheDocument();
    expect(screen.getByText('Ontem')).toBeInTheDocument();
  });

  it('mostra as faltas junto dos turnos concluídos quando houver alguma', async () => {
    getCompanyWorkerHistoryMock.mockResolvedValue({
      workers: [makeWorker({ shiftsCompleted: 3, noShowCount: 2 })],
    });

    render(<TrabalhadoresPage />);

    expect(await screen.findByText(/3 concluído\(s\)/)).toBeInTheDocument();
    expect(screen.getByText(/2 falta\(s\)/)).toBeInTheDocument();
  });

  it('não mostra faltas quando não houve nenhuma', async () => {
    getCompanyWorkerHistoryMock.mockResolvedValue({
      workers: [makeWorker({ shiftsCompleted: 3, noShowCount: 0 })],
    });

    render(<TrabalhadoresPage />);

    await screen.findByText(/3 concluído\(s\)/);
    expect(screen.queryByText(/falta\(s\)/)).not.toBeInTheDocument();
  });

  it('mostra travessão pra nota e comparecimento quando ainda não há dado', async () => {
    getCompanyWorkerHistoryMock.mockResolvedValue({
      workers: [makeWorker({ attendanceRate: null, avgRatingGiven: null, lastWorkedAt: null })],
    });

    render(<TrabalhadoresPage />);

    await screen.findByText('Ana Souza');
    expect(screen.getAllByText('—')).toHaveLength(3);
  });

  it.each([
    [95, 'bg-success/10 text-success'],
    [70, 'bg-warning/10 text-warning'],
    [69, 'bg-danger/10 text-danger'],
  ])('usa a cor certa pro comparecimento de %i%%', async (rate, expectedClass) => {
    getCompanyWorkerHistoryMock.mockResolvedValue({
      workers: [makeWorker({ attendanceRate: rate })],
    });

    render(<TrabalhadoresPage />);

    const badge = await screen.findByText(`${rate}%`);
    expect(badge.className).toContain(expectedClass);
  });

  it('mostra "Hoje" quando o trabalhador trabalhou no mesmo dia', async () => {
    getCompanyWorkerHistoryMock.mockResolvedValue({
      workers: [makeWorker({ lastWorkedAt: '2026-07-14T10:00:00.000Z' })],
    });

    render(<TrabalhadoresPage />);

    expect(await screen.findByText('Hoje')).toBeInTheDocument();
  });

  it('mostra "Há N dias" dentro do mesmo mês, e a data formatada depois de 30 dias', async () => {
    getCompanyWorkerHistoryMock.mockResolvedValue({
      workers: [
        makeWorker({ workerId: 'worker-1', fullName: 'Ana Souza', lastWorkedAt: '2026-07-09T12:00:00.000Z' }),
        makeWorker({ workerId: 'worker-2', fullName: 'Beatriz Lima', lastWorkedAt: '2026-05-01T12:00:00.000Z' }),
      ],
    });

    render(<TrabalhadoresPage />);

    expect(await screen.findByText('Há 5 dias')).toBeInTheDocument();
    expect(screen.getByText('01 de mai. de 2026')).toBeInTheDocument();
  });
});
