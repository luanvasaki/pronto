import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TurnosPage from './page';

const listSkillCategoriesMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    listSkillCategories: (...args: unknown[]) => listSkillCategoriesMock(...args),
  };
});

const listMyShiftsMock = vi.fn();
const checkInMock = vi.fn();
const checkOutMock = vi.fn();
const rateShiftMock = vi.fn();
vi.mock('../../../lib/shifts-api', () => ({
  listMyShifts: (...args: unknown[]) => listMyShiftsMock(...args),
  checkIn: (...args: unknown[]) => checkInMock(...args),
  checkOut: (...args: unknown[]) => checkOutMock(...args),
  rateShift: (...args: unknown[]) => rateShiftMock(...args),
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
  startsAt: '2026-08-01T18:00:00.000Z',
  endsAt: '2026-08-01T23:00:00.000Z',
  status: 'filled',
};

function makeShift(
  overrides: Partial<{
    status: string;
    payment: { id: string; shiftId: string; amount: string; status: string; chargedAt: string | null; releasedAt: string | null } | null;
    ratings: { worker: { id: string; shiftId: string; raterRole: string; score: number; comment: string | null; createdAt: string } | null; company: unknown };
  }> = {},
) {
  return {
    id: 'shift-1',
    applicationId: 'app-1',
    jobId: 'job-1',
    workerId: 'worker-1',
    status: 'scheduled',
    payAmountSnapshot: '130.00',
    checkInAt: null,
    checkInLat: null,
    checkInLng: null,
    checkOutAt: null,
    checkOutLat: null,
    checkOutLng: null,
    job: JOB,
    payment: null,
    ratings: { worker: null, company: null },
    ...overrides,
  };
}

describe('TurnosPage', () => {
  beforeEach(() => {
    listSkillCategoriesMock.mockReset().mockResolvedValue({ categories: [{ id: 'cat-1', name: 'Garçom' }] });
    listMyShiftsMock.mockReset();
    checkInMock.mockReset();
    checkOutMock.mockReset();
    rateShiftMock.mockReset();
    Object.defineProperty(window.navigator, 'geolocation', { value: undefined, configurable: true });
  });

  it('mostra estado vazio quando não há turnos', async () => {
    listMyShiftsMock.mockResolvedValue({ shifts: [] });

    render(<TurnosPage />);

    expect(await screen.findByText('Você ainda não tem turnos agendados.')).toBeInTheDocument();
  });

  it('mostra o botão de check-in pra turno agendado', async () => {
    listMyShiftsMock.mockResolvedValue({ shifts: [makeShift({ status: 'scheduled' })] });

    render(<TurnosPage />);

    expect(await screen.findByText('Agendado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fazer check-in/i })).toBeInTheDocument();
  });

  it('mostra o botão de check-out pra turno em andamento', async () => {
    listMyShiftsMock.mockResolvedValue({ shifts: [makeShift({ status: 'checked_in' })] });

    render(<TurnosPage />);

    expect((await screen.findAllByText('Em andamento')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /fazer check-out/i })).toBeInTheDocument();
  });

  it('não mostra botão de check-in/check-out pra turno concluído', async () => {
    listMyShiftsMock.mockResolvedValue({ shifts: [makeShift({ status: 'completed' })] });

    render(<TurnosPage />);

    await screen.findAllByText('Concluído');
    expect(screen.queryByRole('button', { name: /fazer check-in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /fazer check-out/i })).not.toBeInTheDocument();
  });

  it('mostra o status do pagamento quando existe', async () => {
    listMyShiftsMock.mockResolvedValue({
      shifts: [
        makeShift({
          status: 'completed',
          payment: { id: 'p1', shiftId: 'shift-1', amount: '130.00', status: 'charged', chargedAt: null, releasedAt: null },
        }),
      ],
    });

    render(<TurnosPage />);

    expect(await screen.findByText(/acerte o pagamento direto com a empresa/i)).toBeInTheDocument();
  });

  it('mostra o formulário de avaliação pra turno concluído ainda não avaliado', async () => {
    listMyShiftsMock.mockResolvedValue({ shifts: [makeShift({ status: 'completed' })] });

    render(<TurnosPage />);

    expect(await screen.findByText('Avaliar a empresa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5 de 5' })).toBeInTheDocument();
  });

  it('envia a avaliação com a nota escolhida', async () => {
    listMyShiftsMock.mockResolvedValue({ shifts: [makeShift({ status: 'completed' })] });
    rateShiftMock.mockResolvedValue({
      id: 'rating-1',
      shiftId: 'shift-1',
      raterRole: 'worker',
      score: 4,
      comment: null,
      createdAt: '2026-08-02T00:00:00.000Z',
    });
    const user = userEvent.setup();

    render(<TurnosPage />);
    await screen.findByText('Avaliar a empresa');
    await user.click(screen.getByRole('button', { name: '4 de 5' }));
    await user.click(screen.getByRole('button', { name: /enviar avaliação/i }));

    await waitFor(() => expect(rateShiftMock).toHaveBeenCalledWith('shift-1', 4, undefined));
    expect(await screen.findByText('Você avaliou: 4 de 5.')).toBeInTheDocument();
  });

  it('não mostra o formulário quando o turno já foi avaliado', async () => {
    listMyShiftsMock.mockResolvedValue({
      shifts: [
        makeShift({
          status: 'completed',
          ratings: {
            worker: {
              id: 'rating-1',
              shiftId: 'shift-1',
              raterRole: 'worker',
              score: 3,
              comment: null,
              createdAt: '2026-08-02T00:00:00.000Z',
            },
            company: null,
          },
        }),
      ],
    });

    render(<TurnosPage />);

    expect(await screen.findByText('Você avaliou: 3 de 5.')).toBeInTheDocument();
    expect(screen.queryByText('Avaliar a empresa')).not.toBeInTheDocument();
  });

  it('faz check-in usando a localização do navegador', async () => {
    listMyShiftsMock.mockResolvedValue({ shifts: [makeShift({ status: 'scheduled' })] });
    checkInMock.mockResolvedValue(makeShift({ status: 'checked_in' }));
    Object.defineProperty(window.navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((success) => success({ coords: { latitude: -23.55, longitude: -46.63 } })),
      },
      configurable: true,
    });
    const user = userEvent.setup();

    render(<TurnosPage />);
    await screen.findByText('Agendado');
    await user.click(screen.getByRole('button', { name: /fazer check-in/i }));

    await waitFor(() => expect(screen.getAllByText('Em andamento').length).toBeGreaterThan(0));
    expect(checkInMock).toHaveBeenCalledWith('shift-1', -23.55, -46.63);
  });

  it('mostra mensagem quando o navegador nega a localização no check-in', async () => {
    listMyShiftsMock.mockResolvedValue({ shifts: [makeShift({ status: 'scheduled' })] });
    Object.defineProperty(window.navigator, 'geolocation', {
      value: { getCurrentPosition: vi.fn((_success, failure) => failure()) },
      configurable: true,
    });
    const user = userEvent.setup();

    render(<TurnosPage />);
    await screen.findByText('Agendado');
    await user.click(screen.getByRole('button', { name: /fazer check-in/i }));

    expect(
      await screen.findByText('Precisamos da sua localização para confirmar o check-in.'),
    ).toBeInTheDocument();
    expect(checkInMock).not.toHaveBeenCalled();
  });

  it('busca os turnos de novo depois do check-out, pra mostrar o status do pagamento', async () => {
    // A resposta do check-out não traz `payment` (é criado logo depois) —
    // por isso a tela precisa buscar a lista de novo em vez de confiar só
    // na resposta do check-out.
    listMyShiftsMock
      .mockResolvedValueOnce({ shifts: [makeShift({ status: 'checked_in' })] })
      .mockResolvedValueOnce({
        shifts: [
          makeShift({
            status: 'completed',
            payment: { id: 'p1', shiftId: 'shift-1', amount: '130.00', status: 'charged', chargedAt: null, releasedAt: null },
          }),
        ],
      });
    checkOutMock.mockResolvedValue(makeShift({ status: 'completed' }));
    Object.defineProperty(window.navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((success) => success({ coords: { latitude: -23.55, longitude: -46.63 } })),
      },
      configurable: true,
    });
    const user = userEvent.setup();

    render(<TurnosPage />);
    await screen.findByRole('button', { name: /fazer check-out/i });
    await user.click(screen.getByRole('button', { name: /fazer check-out/i }));

    expect(await screen.findByText(/acerte o pagamento direto com a empresa/i)).toBeInTheDocument();
    expect(listMyShiftsMock).toHaveBeenCalledTimes(2);
  });
});
