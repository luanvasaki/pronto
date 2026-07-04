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
vi.mock('../../lib/shifts-api', () => ({
  listMyShifts: (...args: unknown[]) => listMyShiftsMock(...args),
  checkIn: (...args: unknown[]) => checkInMock(...args),
  checkOut: (...args: unknown[]) => checkOutMock(...args),
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

function makeShift(overrides: Partial<{ status: string }> = {}) {
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
    ...overrides,
  };
}

describe('TurnosPage', () => {
  beforeEach(() => {
    listSkillCategoriesMock.mockReset().mockResolvedValue({ categories: [{ id: 'cat-1', name: 'Garçom' }] });
    listMyShiftsMock.mockReset();
    checkInMock.mockReset();
    checkOutMock.mockReset();
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

    expect(await screen.findByText('Em andamento')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fazer check-out/i })).toBeInTheDocument();
  });

  it('não mostra nenhum botão pra turno concluído', async () => {
    listMyShiftsMock.mockResolvedValue({ shifts: [makeShift({ status: 'completed' })] });

    render(<TurnosPage />);

    await screen.findByText('Concluído');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
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

    await waitFor(() => expect(screen.getByText('Em andamento')).toBeInTheDocument());
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
});
