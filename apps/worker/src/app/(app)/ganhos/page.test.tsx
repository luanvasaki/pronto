import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GanhosPage from './page';

const listMyShiftsMock = vi.fn();
vi.mock('../../../lib/shifts-api', () => ({
  listMyShifts: (...args: unknown[]) => listMyShiftsMock(...args),
}));

const JOB = {
  id: 'job-1',
  categoryId: 'cat-1',
  description: 'Vaga de garçom',
  addressLabel: 'Vila Madalena, São Paulo',
  locationLat: -23.55,
  locationLng: -46.63,
  positionsTotal: 1,
  positionsFilled: 1,
  payAmount: '130.00',
  startsAt: '2026-07-05T18:00:00.000Z',
  endsAt: '2026-07-05T23:00:00.000Z',
  status: 'filled',
};

function makeShift(
  overrides: Partial<{
    id: string;
    status: string;
    job: typeof JOB;
    companyName: string;
    payAmountSnapshot: string;
    payment: { id: string; shiftId: string; amount: string; status: string; chargedAt: string | null; releasedAt: string | null } | null;
  }> = {},
) {
  return {
    id: 'shift-1',
    applicationId: 'app-1',
    jobId: 'job-1',
    workerId: 'worker-1',
    status: 'completed',
    payAmountSnapshot: '130.00',
    checkInAt: null,
    checkInLat: null,
    checkInLng: null,
    checkOutAt: null,
    checkOutLat: null,
    checkOutLng: null,
    job: JOB,
    companyName: 'Buffet Aurora',
    payment: null,
    ratings: { worker: null, company: null },
    ...overrides,
  };
}

describe('GanhosPage', () => {
  beforeEach(() => {
    listMyShiftsMock.mockReset();
    // "Mês atual" é calculado com `new Date()` de verdade — fixa só o
    // relógio (não os timers de setTimeout/setInterval, pra não travar o
    // `findBy*` do testing-library) pra não depender do dia em que a
    // suíte roda — senão os testes que comparam com os turnos de
    // julho/2026 quebram sozinhos em agosto.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra estado vazio quando não há turnos concluídos', async () => {
    listMyShiftsMock.mockResolvedValue({ shifts: [makeShift({ status: 'scheduled' })] });

    render(<GanhosPage />);

    expect(await screen.findByText('Nenhum ganho ainda')).toBeInTheDocument();
    expect(screen.getByText(/combine o pagamento direto com a empresa/i)).toBeInTheDocument();
    expect(screen.getByText('Nenhum ganho registrado ainda')).toBeInTheDocument();
  });

  it('soma corretamente turnos concluídos de mais de um mês, mais recente primeiro', async () => {
    listMyShiftsMock.mockResolvedValue({
      shifts: [
        makeShift({
          id: 'shift-jun',
          status: 'completed',
          payAmountSnapshot: '100.00',
          job: { ...JOB, startsAt: '2026-06-10T18:00:00.000Z', endsAt: '2026-06-10T23:00:00.000Z' },
        }),
        makeShift({
          id: 'shift-jul-1',
          status: 'completed',
          payAmountSnapshot: '130.00',
          job: { ...JOB, startsAt: '2026-07-05T18:00:00.000Z', endsAt: '2026-07-05T23:00:00.000Z' },
        }),
        makeShift({
          id: 'shift-jul-2',
          status: 'completed',
          payAmountSnapshot: '70.50',
          job: { ...JOB, startsAt: '2026-07-08T18:00:00.000Z', endsAt: '2026-07-08T23:00:00.000Z' },
        }),
      ],
    });

    render(<GanhosPage />);

    await screen.findByText('Ganhos');

    // Mês atual (julho de 2026, considerando a data do sistema em teste) soma 200,50.
    // Aparece duas vezes: no destaque do topo e no total do grupo do mês.
    expect(screen.getAllByText('R$ 200,50')).toHaveLength(2);

    const monthHeadings = screen.getAllByRole('heading', { level: 2 }).map((el) => el.textContent);
    expect(monthHeadings[0]).toMatch(/julho de 2026/i);
    expect(monthHeadings[1]).toMatch(/junho de 2026/i);

    // Aparece 2x pro mês de junho: total do grupo e valor do turno.
    expect(screen.getAllByText('R$ 100,00')).toHaveLength(2);
  });

  it('não inclui turnos com status diferente de completed na soma', async () => {
    listMyShiftsMock.mockResolvedValue({
      shifts: [
        makeShift({ id: 'shift-scheduled', status: 'scheduled', payAmountSnapshot: '999.00' }),
        makeShift({ id: 'shift-no-show', status: 'no_show', payAmountSnapshot: '999.00' }),
        makeShift({ id: 'shift-cancelled', status: 'cancelled', payAmountSnapshot: '999.00' }),
        makeShift({ id: 'shift-checked-in', status: 'checked_in', payAmountSnapshot: '999.00' }),
        makeShift({ id: 'shift-completed', status: 'completed', payAmountSnapshot: '130.00' }),
      ],
    });

    render(<GanhosPage />);

    await screen.findByText('Ganhos');

    // Aparece 3x: destaque do mês, total do grupo do mês e valor do turno —
    // nenhum dos turnos com outros status entra na soma.
    expect(screen.getAllByText('R$ 130,00')).toHaveLength(3);
    expect(screen.queryByText('R$ 1.267,00')).not.toBeInTheDocument();
    // Só o turno concluído aparece na lista.
    expect(screen.getAllByText('Buffet Aurora')).toHaveLength(1);
  });

  it('mostra o indicativo de status de pagamento quando existe', async () => {
    listMyShiftsMock.mockResolvedValue({
      shifts: [
        makeShift({
          status: 'completed',
          payment: { id: 'p1', shiftId: 'shift-1', amount: '130.00', status: 'confirmed', chargedAt: null, releasedAt: null },
        }),
      ],
    });

    render(<GanhosPage />);

    expect(await screen.findByText('Recebimento confirmado')).toBeInTheDocument();
  });
});
