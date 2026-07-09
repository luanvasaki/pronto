import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VagaCandidatosPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useParams: () => ({ id: 'job-1' }),
}));

vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    getCurrentUser: vi.fn().mockResolvedValue({ user: { id: '1' } }),
  };
});

const listJobApplicationsMock = vi.fn();
const updateApplicationStatusMock = vi.fn();
const rateShiftMock = vi.fn();
const releasePaymentMock = vi.fn();
vi.mock('../../../../lib/applications-api', () => ({
  listJobApplications: (...args: unknown[]) => listJobApplicationsMock(...args),
  updateApplicationStatus: (...args: unknown[]) => updateApplicationStatusMock(...args),
  rateShift: (...args: unknown[]) => rateShiftMock(...args),
  releasePayment: (...args: unknown[]) => releasePaymentMock(...args),
}));

const PENDING_APPLICATION = {
  id: 'app-1',
  status: 'pending',
  createdAt: '2026-07-01T12:00:00.000Z',
  experienceMismatch: false,
  worker: { id: 'worker-1', fullName: 'Ana Souza', avgRating: null, matchesSkills: true },
  shift: null,
};

function makeCompletedApplication(
  overrides: Partial<{
    payment: { id: string; shiftId: string; amount: string; status: string; chargedAt: string | null; releasedAt: string | null } | null;
    ratings: { worker: unknown; company: { id: string; shiftId: string; raterRole: string; score: number; comment: string | null; createdAt: string } | null };
  }> = {},
) {
  return {
    ...PENDING_APPLICATION,
    status: 'approved',
    shift: {
      id: 'shift-1',
      status: 'completed',
      checkInAt: '2026-07-01T18:00:00.000Z',
      checkOutAt: '2026-07-01T23:00:00.000Z',
      payment: null,
      ratings: { worker: null, company: null },
      ...overrides,
    },
  };
}

describe('VagaCandidatosPage', () => {
  beforeEach(() => {
    listJobApplicationsMock.mockReset();
    updateApplicationStatusMock.mockReset();
    rateShiftMock.mockReset();
    releasePaymentMock.mockReset();
  });

  it('mostra estado vazio quando não há candidatos', async () => {
    listJobApplicationsMock.mockResolvedValue({ applications: [] });

    render(<VagaCandidatosPage />);

    expect(
      await screen.findByText('Ninguém se candidatou a essa vaga ainda.'),
    ).toBeInTheDocument();
    expect(listJobApplicationsMock).toHaveBeenCalledWith('job-1');
  });

  it('lista os candidatos com nome e status', async () => {
    listJobApplicationsMock.mockResolvedValue({ applications: [PENDING_APPLICATION] });

    render(<VagaCandidatosPage />);

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('Em análise')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aprovar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rejeitar/i })).toBeInTheDocument();
  });

  it('avisa quando o candidato não tem a especialidade da vaga', async () => {
    listJobApplicationsMock.mockResolvedValue({
      applications: [{ ...PENDING_APPLICATION, worker: { ...PENDING_APPLICATION.worker, matchesSkills: false } }],
    });

    render(<VagaCandidatosPage />);

    await screen.findByText('Ana Souza');
    expect(screen.getByText('Esse profissional não tem essa especialidade no perfil dele.')).toBeInTheDocument();
  });

  it('avisa quando a vaga exige experiência e o candidato não declarou ter', async () => {
    listJobApplicationsMock.mockResolvedValue({
      applications: [{ ...PENDING_APPLICATION, experienceMismatch: true }],
    });

    render(<VagaCandidatosPage />);

    await screen.findByText('Ana Souza');
    expect(
      screen.getByText('Essa vaga exige experiência anterior e esse profissional não declarou ter.'),
    ).toBeInTheDocument();
  });

  it('não mostra botões de decisão pra candidatura já respondida', async () => {
    listJobApplicationsMock.mockResolvedValue({
      applications: [{ ...PENDING_APPLICATION, status: 'approved' }],
    });

    render(<VagaCandidatosPage />);

    await screen.findByText('Ana Souza');
    expect(screen.queryByRole('button', { name: /aprovar/i })).not.toBeInTheDocument();
  });

  it('aprova um candidato, recarrega a lista e mostra o turno criado', async () => {
    const approvedWithShift = {
      ...PENDING_APPLICATION,
      status: 'approved',
      shift: { id: 'shift-1', status: 'scheduled', checkInAt: null, checkOutAt: null, payment: null, ratings: { worker: null, company: null } },
    };
    listJobApplicationsMock
      .mockResolvedValueOnce({ applications: [PENDING_APPLICATION] })
      .mockResolvedValueOnce({ applications: [approvedWithShift] });
    updateApplicationStatusMock.mockResolvedValue({ id: 'app-1', status: 'approved' });
    const user = userEvent.setup();

    render(<VagaCandidatosPage />);
    await screen.findByText('Ana Souza');
    await user.click(screen.getByRole('button', { name: /aprovar/i }));

    await waitFor(() => expect(screen.getByText('Aprovado')).toBeInTheDocument());
    expect(screen.getByText('Turno: Aguardando check-in')).toBeInTheDocument();
    expect(updateApplicationStatusMock).toHaveBeenCalledWith('app-1', 'approved');
    expect(listJobApplicationsMock).toHaveBeenCalledTimes(2);
  });

  it('mostra a mensagem da API quando a decisão falha', async () => {
    listJobApplicationsMock.mockResolvedValue({ applications: [PENDING_APPLICATION] });
    updateApplicationStatusMock.mockRejectedValue(new Error('falha de rede'));
    const user = userEvent.setup();

    render(<VagaCandidatosPage />);
    await screen.findByText('Ana Souza');
    await user.click(screen.getByRole('button', { name: /rejeitar/i }));

    expect(
      await screen.findByText('Não foi possível atualizar a candidatura.'),
    ).toBeInTheDocument();
  });

  it('mostra o botão de marcar como pago quando o turno está concluído', async () => {
    listJobApplicationsMock.mockResolvedValue({
      applications: [
        makeCompletedApplication({
          payment: { id: 'p1', shiftId: 'shift-1', amount: '130.00', status: 'charged', chargedAt: null, releasedAt: null },
        }),
      ],
    });

    render(<VagaCandidatosPage />);

    expect(await screen.findByText('Turno concluído — combine o pagamento com o profissional')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /marcar como pago/i })).toBeInTheDocument();
  });

  it('marca como pago e atualiza o status', async () => {
    listJobApplicationsMock.mockResolvedValue({
      applications: [
        makeCompletedApplication({
          payment: { id: 'p1', shiftId: 'shift-1', amount: '130.00', status: 'charged', chargedAt: null, releasedAt: null },
        }),
      ],
    });
    releasePaymentMock.mockResolvedValue({
      id: 'p1',
      shiftId: 'shift-1',
      amount: '130.00',
      status: 'released',
      chargedAt: null,
      releasedAt: '2026-07-02T00:00:00.000Z',
    });
    const user = userEvent.setup();

    render(<VagaCandidatosPage />);
    await screen.findByRole('button', { name: /marcar como pago/i });
    await user.click(screen.getByRole('button', { name: /marcar como pago/i }));

    expect(await screen.findByText(/marcado como pago/i)).toBeInTheDocument();
    expect(releasePaymentMock).toHaveBeenCalledWith('shift-1');
  });

  it('mostra quando o profissional confirmou o recebimento', async () => {
    listJobApplicationsMock.mockResolvedValue({
      applications: [
        makeCompletedApplication({
          payment: { id: 'p1', shiftId: 'shift-1', amount: '130.00', status: 'confirmed', chargedAt: null, releasedAt: null },
        }),
      ],
    });

    render(<VagaCandidatosPage />);

    expect(await screen.findByText('Profissional confirmou o recebimento')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /marcar como pago/i })).not.toBeInTheDocument();
  });

  it('destaca quando o profissional avisa que não recebeu', async () => {
    listJobApplicationsMock.mockResolvedValue({
      applications: [
        makeCompletedApplication({
          payment: { id: 'p1', shiftId: 'shift-1', amount: '130.00', status: 'disputed', chargedAt: null, releasedAt: null },
        }),
      ],
    });

    render(<VagaCandidatosPage />);

    const message = await screen.findByText('Profissional avisou que não recebeu');
    expect(message).toHaveClass('text-danger');
  });

  it('mostra o formulário de avaliação pra turno concluído ainda não avaliado', async () => {
    listJobApplicationsMock.mockResolvedValue({ applications: [makeCompletedApplication()] });

    render(<VagaCandidatosPage />);

    expect(await screen.findByText('Avaliar o trabalhador')).toBeInTheDocument();
  });

  it('envia a avaliação do trabalhador', async () => {
    listJobApplicationsMock.mockResolvedValue({ applications: [makeCompletedApplication()] });
    rateShiftMock.mockResolvedValue({
      id: 'rating-1',
      shiftId: 'shift-1',
      raterRole: 'company',
      score: 5,
      comment: null,
      createdAt: '2026-07-02T00:00:00.000Z',
    });
    const user = userEvent.setup();

    render(<VagaCandidatosPage />);
    await screen.findByText('Avaliar o trabalhador');
    await user.click(screen.getByRole('button', { name: '5 de 5' }));
    await user.click(screen.getByRole('button', { name: /enviar avaliação/i }));

    await waitFor(() => expect(rateShiftMock).toHaveBeenCalledWith('shift-1', 5, undefined));
    expect(await screen.findByText('Você avaliou: 5 de 5.')).toBeInTheDocument();
  });

  it('não mostra o formulário quando o turno já foi avaliado', async () => {
    listJobApplicationsMock.mockResolvedValue({
      applications: [
        makeCompletedApplication({
          ratings: {
            worker: null,
            company: { id: 'rating-1', shiftId: 'shift-1', raterRole: 'company', score: 4, comment: null, createdAt: '2026-07-02T00:00:00.000Z' },
          },
        }),
      ],
    });

    render(<VagaCandidatosPage />);

    expect(await screen.findByText('Você avaliou: 4 de 5.')).toBeInTheDocument();
    expect(screen.queryByText('Avaliar o trabalhador')).not.toBeInTheDocument();
  });
});
