import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveEventView } from './live-event-view';

const getLiveEventStatusMock = vi.fn();
vi.mock('../../../lib/live-event-api', () => ({
  getLiveEventStatus: (...args: unknown[]) => getLiveEventStatusMock(...args),
}));

// Quinta-feira à tarde — evita qualquer ambiguidade de fuso no rótulo "Hoje".
const NOW = new Date('2026-08-06T15:00:00.000Z');

function makeJob(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    jobId: 'job-1',
    categoryName: 'Garçom',
    addressLabel: 'Vila Madalena, São Paulo',
    startsAt: '2026-08-06T14:00:00.000Z',
    endsAt: '2026-08-06T19:00:00.000Z',
    positionsTotal: 2,
    positionsFilled: 2,
    shifts: [],
    ...overrides,
  };
}

describe('LiveEventView', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
    getLiveEventStatusMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra estado vazio quando não há escala no dia', async () => {
    getLiveEventStatusMock.mockResolvedValue({ jobs: [] });

    render(<LiveEventView />);

    expect(await screen.findByText('Nenhuma escala nesse dia.')).toBeInTheDocument();
  });

  it('mostra o status de cada trabalhador na vaga', async () => {
    getLiveEventStatusMock.mockResolvedValue({
      jobs: [
        makeJob({
          shifts: [
            {
              shiftId: 's1',
              workerId: 'w1',
              workerName: 'Ana Souza',
              workerPhotoUrl: null,
              status: 'atrasado',
              checkInAt: null,
              checkOutAt: null,
              minutesLate: 20,
            },
            {
              shiftId: 's2',
              workerId: 'w2',
              workerName: 'Beatriz Lima',
              workerPhotoUrl: null,
              status: 'chegou',
              checkInAt: '2026-08-06T14:05:00.000Z',
              checkOutAt: null,
              minutesLate: null,
            },
          ],
        }),
      ],
    });

    render(<LiveEventView />);

    expect(await screen.findByText('Garçom')).toBeInTheDocument();
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('Atrasado')).toBeInTheDocument();
    expect(screen.getByText('20 min')).toBeInTheDocument();
    expect(screen.getByText('Beatriz Lima')).toBeInTheDocument();
    expect(screen.getByText('Chegou')).toBeInTheDocument();
  });

  it('mostra o banner de atraso só quando há gente atrasada', async () => {
    getLiveEventStatusMock.mockResolvedValue({
      jobs: [
        makeJob({
          positionsTotal: 1,
          positionsFilled: 1,
          shifts: [
            {
              shiftId: 's1',
              workerId: 'w1',
              workerName: 'Ana Souza',
              workerPhotoUrl: null,
              status: 'atrasado',
              checkInAt: null,
              checkOutAt: null,
              minutesLate: 10,
            },
          ],
        }),
      ],
    });

    render(<LiveEventView />);

    expect(await screen.findByText('1 pessoa atrasada de 1 escalada(s) hoje.')).toBeInTheDocument();
  });

  it('não mostra o banner de atraso quando ninguém está atrasado', async () => {
    getLiveEventStatusMock.mockResolvedValue({
      jobs: [
        makeJob({
          shifts: [
            {
              shiftId: 's1',
              workerId: 'w1',
              workerName: 'Ana Souza',
              workerPhotoUrl: null,
              status: 'concluido',
              checkInAt: '2026-08-06T14:00:00.000Z',
              checkOutAt: '2026-08-06T18:00:00.000Z',
              minutesLate: null,
            },
          ],
        }),
      ],
    });

    render(<LiveEventView />);

    await screen.findByText('Garçom');
    expect(screen.queryByText(/atrasada/)).not.toBeInTheDocument();
  });

  it('navega pro dia seguinte e recarrega os dados', async () => {
    getLiveEventStatusMock.mockResolvedValue({ jobs: [] });
    const user = userEvent.setup();

    render(<LiveEventView />);
    await screen.findByRole('heading', { name: 'Hoje' });

    await user.click(screen.getByRole('button', { name: 'Próximo dia' }));

    expect(await screen.findByRole('heading', { name: 'Amanhã' })).toBeInTheDocument();
    expect(getLiveEventStatusMock).toHaveBeenCalledTimes(2);
  });

  it('mostra mensagem de erro quando a busca falha', async () => {
    getLiveEventStatusMock.mockRejectedValue(new Error('falha'));

    render(<LiveEventView />);

    expect(await screen.findByText('Não foi possível carregar a operação ao vivo.')).toBeInTheDocument();
  });
});
