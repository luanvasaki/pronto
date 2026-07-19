import { ApiError } from '@shift/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VagaCandidatosPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useParams: () => ({ id: 'job-1' }),
}));

const rateShiftMock = vi.fn();
const skipRatingMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    getCurrentUser: vi.fn().mockResolvedValue({ user: { id: '1' } }),
    rateShift: (...args: unknown[]) => rateShiftMock(...args),
    skipRating: (...args: unknown[]) => skipRatingMock(...args),
  };
});

const listJobApplicationsMock = vi.fn();
const updateApplicationStatusMock = vi.fn();
const releasePaymentMock = vi.fn();
const removeApprovedWorkerMock = vi.fn();
const confirmCheckInMock = vi.fn();
const confirmCheckOutMock = vi.fn();
vi.mock('../../../../lib/applications-api', () => ({
  listJobApplications: (...args: unknown[]) => listJobApplicationsMock(...args),
  updateApplicationStatus: (...args: unknown[]) => updateApplicationStatusMock(...args),
  releasePayment: (...args: unknown[]) => releasePaymentMock(...args),
  removeApprovedWorker: (...args: unknown[]) => removeApprovedWorkerMock(...args),
  confirmCheckIn: (...args: unknown[]) => confirmCheckInMock(...args),
  confirmCheckOut: (...args: unknown[]) => confirmCheckOutMock(...args),
}));

const listMyJobsMock = vi.fn();
vi.mock('../../../../lib/jobs-api', () => ({
  listMyJobs: (...args: unknown[]) => listMyJobsMock(...args),
}));

const listJobAnnouncementsMock = vi.fn();
const createAnnouncementMock = vi.fn();
vi.mock('../../../../lib/announcements-api', () => ({
  listJobAnnouncements: (...args: unknown[]) => listJobAnnouncementsMock(...args),
  createAnnouncement: (...args: unknown[]) => createAnnouncementMock(...args),
}));

const listJobQuestionsMock = vi.fn();
const answerQuestionMock = vi.fn();
vi.mock('../../../../lib/questions-api', () => ({
  listJobQuestions: (...args: unknown[]) => listJobQuestionsMock(...args),
  answerQuestion: (...args: unknown[]) => answerQuestionMock(...args),
}));

const PENDING_APPLICATION = {
  id: 'app-1',
  status: 'pending',
  createdAt: '2026-07-01T12:00:00.000Z',
  removedAt: null,
  experienceMismatch: false,
  worker: {
    id: 'worker-1',
    fullName: 'Ana Souza',
    avgRating: null,
    avgCategoryScores: null,
    matchesSkills: true,
    previousShiftsWithCompany: 0,
  },
  shift: null,
};

function makeCompletedApplication(
  overrides: Partial<{
    payment: { id: string; shiftId: string; amount: string; status: string; chargedAt: string | null; releasedAt: string | null } | null;
    ratings: {
      worker: unknown;
      company:
        | {
            id: string;
            shiftId: string;
            raterRole: string;
            score: number;
            categoryScores: Record<string, number> | null;
            comment: string | null;
            createdAt: string;
          }
        | null;
    };
  }> = {},
) {
  return {
    ...PENDING_APPLICATION,
    status: 'approved',
    shift: {
      id: 'shift-1',
      status: 'completed',
      checkInAt: '2026-07-01T18:00:00.000Z',
      checkInConfirmedAt: '2026-07-01T18:05:00.000Z',
      checkOutAt: '2026-07-01T23:00:00.000Z',
      checkOutConfirmedAt: '2026-07-01T23:05:00.000Z',
      payment: null,
      ratings: { worker: null, company: null },
      ...overrides,
    },
  };
}

function makeInProgressApplication(
  overrides: Partial<{
    status: string;
    checkInConfirmedAt: string | null;
    checkOutConfirmedAt: string | null;
  }> = {},
) {
  return {
    ...PENDING_APPLICATION,
    status: 'approved',
    shift: {
      id: 'shift-1',
      status: 'checked_in',
      checkInAt: '2026-07-01T18:00:00.000Z',
      checkInConfirmedAt: null,
      checkOutAt: null,
      checkOutConfirmedAt: null,
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
    skipRatingMock.mockReset();
    releasePaymentMock.mockReset();
    removeApprovedWorkerMock.mockReset();
    confirmCheckInMock.mockReset();
    confirmCheckOutMock.mockReset();
    listMyJobsMock.mockReset();
    listMyJobsMock.mockResolvedValue({ jobs: [] });
    listJobAnnouncementsMock.mockReset().mockResolvedValue({ announcements: [] });
    createAnnouncementMock.mockReset();
    listJobQuestionsMock.mockReset().mockResolvedValue({ questions: [] });
    answerQuestionMock.mockReset();
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

  it('mostra quantas vezes o candidato já trabalhou com a empresa', async () => {
    listJobApplicationsMock.mockResolvedValue({
      applications: [
        { ...PENDING_APPLICATION, worker: { ...PENDING_APPLICATION.worker, previousShiftsWithCompany: 3 } },
      ],
    });

    render(<VagaCandidatosPage />);

    expect(await screen.findByText('✓ Já trabalhou 3x com você')).toBeInTheDocument();
  });

  it('não mostra o selo de "já trabalhou" pra quem nunca trabalhou com a empresa', async () => {
    listJobApplicationsMock.mockResolvedValue({ applications: [PENDING_APPLICATION] });

    render(<VagaCandidatosPage />);

    await screen.findByText('Ana Souza');
    expect(screen.queryByText(/já trabalhou/i)).not.toBeInTheDocument();
  });

  it('não mostra botões de decisão pra candidatura já respondida', async () => {
    listJobApplicationsMock.mockResolvedValue({
      applications: [{ ...PENDING_APPLICATION, status: 'approved' }],
    });

    render(<VagaCandidatosPage />);

    await screen.findByText('Ana Souza');
    expect(screen.queryByRole('button', { name: /aprovar/i })).not.toBeInTheDocument();
  });

  it('pede confirmação antes de aprovar, e cancelar não chama a API', async () => {
    listJobApplicationsMock.mockResolvedValue({ applications: [PENDING_APPLICATION] });
    const user = userEvent.setup();

    render(<VagaCandidatosPage />);
    await user.click(await screen.findByRole('button', { name: /^aprovar$/i }));

    expect(screen.getByText(/aprovar cria a escala de verdade/i)).toBeInTheDocument();
    await user.click(screen.getByText('Cancelar'));

    expect(screen.queryByText(/aprovar cria a escala de verdade/i)).not.toBeInTheDocument();
    expect(updateApplicationStatusMock).not.toHaveBeenCalled();
  });

  it('aprova um candidato ao confirmar, recarrega a lista e mostra o turno criado', async () => {
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
    await user.click(screen.getByRole('button', { name: /^aprovar$/i }));
    await user.click(screen.getByRole('button', { name: /sim, aprovar/i }));

    await waitFor(() => expect(screen.getByText('Aprovado')).toBeInTheDocument());
    expect(screen.getByText('Escala: Aguardando check-in')).toBeInTheDocument();
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

  const APPROVED_SCHEDULED = {
    ...PENDING_APPLICATION,
    status: 'approved',
    shift: { id: 'shift-1', status: 'scheduled', checkInAt: null, checkOutAt: null, payment: null, ratings: { worker: null, company: null } },
  };

  it('mostra o botão de remover candidato aprovado com turno agendado', async () => {
    listJobApplicationsMock.mockResolvedValue({ applications: [APPROVED_SCHEDULED] });

    render(<VagaCandidatosPage />);

    expect(await screen.findByRole('button', { name: /remover candidato/i })).toBeInTheDocument();
  });

  it('não mostra o botão de remover quando o turno já começou', async () => {
    listJobApplicationsMock.mockResolvedValue({
      applications: [{ ...APPROVED_SCHEDULED, shift: { ...APPROVED_SCHEDULED.shift, status: 'checked_in' } }],
    });

    render(<VagaCandidatosPage />);

    await screen.findByText('Ana Souza');
    expect(screen.queryByRole('button', { name: /remover candidato/i })).not.toBeInTheDocument();
  });

  it('pede confirmação antes de remover, e cancelar não chama a API', async () => {
    listJobApplicationsMock.mockResolvedValue({ applications: [APPROVED_SCHEDULED] });
    const user = userEvent.setup();

    render(<VagaCandidatosPage />);
    await user.click(await screen.findByRole('button', { name: /remover candidato/i }));

    expect(screen.getByText(/tem certeza/i)).toBeInTheDocument();
    await user.click(screen.getByText('Cancelar'));

    expect(screen.queryByText(/tem certeza/i)).not.toBeInTheDocument();
    expect(removeApprovedWorkerMock).not.toHaveBeenCalled();
  });

  it('remove o candidato ao confirmar e recarrega a lista como "Removido"', async () => {
    const removed = { ...APPROVED_SCHEDULED, status: 'rejected', removedAt: '2026-07-03T12:00:00.000Z' };
    listJobApplicationsMock
      .mockResolvedValueOnce({ applications: [APPROVED_SCHEDULED] })
      .mockResolvedValueOnce({ applications: [removed] });
    removeApprovedWorkerMock.mockResolvedValue({ id: 'app-1', status: 'rejected' });
    const user = userEvent.setup();

    render(<VagaCandidatosPage />);
    await user.click(await screen.findByRole('button', { name: /remover candidato/i }));
    await user.click(screen.getByRole('button', { name: /sim, remover/i }));

    await waitFor(() => expect(screen.getByText('Removido')).toBeInTheDocument());
    expect(removeApprovedWorkerMock).toHaveBeenCalledWith('app-1');
    expect(listJobApplicationsMock).toHaveBeenCalledTimes(2);
  });

  it('mostra a mensagem da API quando remover falha', async () => {
    listJobApplicationsMock.mockResolvedValue({ applications: [APPROVED_SCHEDULED] });
    removeApprovedWorkerMock.mockRejectedValue(new Error('falha de rede'));
    const user = userEvent.setup();

    render(<VagaCandidatosPage />);
    await user.click(await screen.findByRole('button', { name: /remover candidato/i }));
    await user.click(screen.getByRole('button', { name: /sim, remover/i }));

    expect(await screen.findByText('Não foi possível remover esse candidato.')).toBeInTheDocument();
  });

  it('mostra o botão de confirmar chegada quando o trabalhador fez check-in e ainda não foi confirmado', async () => {
    listJobApplicationsMock.mockResolvedValue({ applications: [makeInProgressApplication()] });

    render(<VagaCandidatosPage />);

    expect(await screen.findByRole('button', { name: /confirmar chegada/i })).toBeInTheDocument();
  });

  it('confirma a chegada e o botão some', async () => {
    listJobApplicationsMock.mockResolvedValue({ applications: [makeInProgressApplication()] });
    confirmCheckInMock.mockResolvedValue({
      id: 'shift-1',
      status: 'checked_in',
      checkInConfirmedAt: '2026-07-01T18:05:00.000Z',
      checkOutConfirmedAt: null,
    });
    const user = userEvent.setup();

    render(<VagaCandidatosPage />);
    await user.click(await screen.findByRole('button', { name: /confirmar chegada/i }));

    expect(confirmCheckInMock).toHaveBeenCalledWith('shift-1');
    await waitFor(() => expect(screen.queryByRole('button', { name: /confirmar chegada/i })).not.toBeInTheDocument());
  });

  it('não mostra o botão de confirmar chegada depois que já foi confirmada', async () => {
    listJobApplicationsMock.mockResolvedValue({
      applications: [makeInProgressApplication({ checkInConfirmedAt: '2026-07-01T18:05:00.000Z' })],
    });

    render(<VagaCandidatosPage />);
    await screen.findByText('Ana Souza');

    expect(screen.queryByRole('button', { name: /confirmar chegada/i })).not.toBeInTheDocument();
  });

  it('mostra o botão de confirmar saída quando o trabalhador fez check-out, com confirmação em duas etapas', async () => {
    listJobApplicationsMock.mockResolvedValue({
      applications: [
        makeInProgressApplication({
          status: 'checked_out',
          checkInConfirmedAt: '2026-07-01T18:05:00.000Z',
        }),
      ],
    });
    confirmCheckOutMock.mockResolvedValue({
      id: 'shift-1',
      status: 'completed',
      checkInConfirmedAt: '2026-07-01T18:05:00.000Z',
      checkOutConfirmedAt: '2026-07-01T23:05:00.000Z',
    });
    const user = userEvent.setup();

    render(<VagaCandidatosPage />);
    await user.click(await screen.findByRole('button', { name: /^confirmar saída$/i }));
    expect(confirmCheckOutMock).not.toHaveBeenCalled();

    await user.click(await screen.findByRole('button', { name: /sim, confirmar saída/i }));

    expect(confirmCheckOutMock).toHaveBeenCalledWith('shift-1');
    await waitFor(() => expect(screen.queryByRole('button', { name: /confirmar saída/i })).not.toBeInTheDocument());
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

    expect(await screen.findByText('Escala concluída — combine o pagamento com o profissional')).toBeInTheDocument();
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
    await user.click(await screen.findByRole('button', { name: /sim, marcar como pago/i }));

    expect(await screen.findByText(/marcado como pago/i)).toBeInTheDocument();
    expect(releasePaymentMock).toHaveBeenCalledWith('shift-1');
  });

  it('cancela a confirmação de "marcar como pago" sem chamar a API', async () => {
    listJobApplicationsMock.mockResolvedValue({
      applications: [
        makeCompletedApplication({
          payment: { id: 'p1', shiftId: 'shift-1', amount: '130.00', status: 'charged', chargedAt: null, releasedAt: null },
        }),
      ],
    });
    const user = userEvent.setup();

    render(<VagaCandidatosPage />);
    await screen.findByRole('button', { name: /marcar como pago/i });
    await user.click(screen.getByRole('button', { name: /marcar como pago/i }));
    await user.click(await screen.findByRole('button', { name: /cancelar/i }));

    expect(screen.queryByRole('button', { name: /sim, marcar como pago/i })).not.toBeInTheDocument();
    expect(releasePaymentMock).not.toHaveBeenCalled();
  });

  it('mostra erro e mantém o pagamento como "charged" quando marcar como pago falha', async () => {
    listJobApplicationsMock.mockResolvedValue({
      applications: [
        makeCompletedApplication({
          payment: { id: 'p1', shiftId: 'shift-1', amount: '130.00', status: 'charged', chargedAt: null, releasedAt: null },
        }),
      ],
    });
    releasePaymentMock.mockRejectedValue(new ApiError(400, 'Esse pagamento não está pronto pra liberação.'));
    const user = userEvent.setup();

    render(<VagaCandidatosPage />);
    await screen.findByRole('button', { name: /marcar como pago/i });
    await user.click(screen.getByRole('button', { name: /marcar como pago/i }));
    await user.click(await screen.findByRole('button', { name: /sim, marcar como pago/i }));

    expect(await screen.findByText('Esse pagamento não está pronto pra liberação.')).toBeInTheDocument();
    expect(screen.queryByText(/marcado como pago/i)).not.toBeInTheDocument();
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

    const message = await screen.findByText('Profissional confirmou o recebimento');
    expect(screen.queryByRole('button', { name: /marcar como pago/i })).not.toBeInTheDocument();
    expect(message).not.toHaveClass('text-danger');
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
    expect(message).toHaveClass('font-semibold', 'text-danger');
  });

  it('mostra o formulário de avaliação pra turno concluído ainda não avaliado', async () => {
    listJobApplicationsMock.mockResolvedValue({ applications: [makeCompletedApplication()] });

    render(<VagaCandidatosPage />);

    expect(await screen.findByText('Avaliar o trabalhador')).toBeInTheDocument();
  });

  it('envia a avaliação só depois de preencher as 5 categorias', async () => {
    listJobApplicationsMock.mockResolvedValue({ applications: [makeCompletedApplication()] });
    rateShiftMock.mockResolvedValue({
      id: 'rating-1',
      shiftId: 'shift-1',
      raterRole: 'company',
      score: 5,
      categoryScores: { pontualidade: 5, educacao: 5, proatividade: 5, comunicacao: 5, qualidade: 5 },
      comment: null,
      createdAt: '2026-07-02T00:00:00.000Z',
    });
    const user = userEvent.setup();

    render(<VagaCandidatosPage />);
    await screen.findByText('Avaliar o trabalhador');

    expect(screen.getByRole('button', { name: /enviar avaliação/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Pontualidade: 5 de 5' }));
    await user.click(screen.getByRole('button', { name: 'Educação e respeito: 5 de 5' }));
    await user.click(screen.getByRole('button', { name: 'Proatividade: 5 de 5' }));
    await user.click(screen.getByRole('button', { name: 'Comunicação: 5 de 5' }));
    await user.click(screen.getByRole('button', { name: 'Qualidade do trabalho: 5 de 5' }));
    await user.click(screen.getByRole('button', { name: /enviar avaliação/i }));

    await waitFor(() =>
      expect(rateShiftMock).toHaveBeenCalledWith(
        'shift-1',
        { pontualidade: 5, educacao: 5, proatividade: 5, comunicacao: 5, qualidade: 5 },
        undefined,
      ),
    );
    expect(await screen.findByText('Você avaliou: 5 de 5.')).toBeInTheDocument();
  });

  it('ignora a avaliação ao clicar em "Agora não", e permite avaliar mesmo assim depois', async () => {
    listJobApplicationsMock.mockResolvedValue({ applications: [makeCompletedApplication()] });
    skipRatingMock.mockResolvedValue({ shiftId: 'shift-1', skippedAt: '2026-07-03T00:00:00.000Z' });
    const user = userEvent.setup();

    render(<VagaCandidatosPage />);
    await screen.findByText('Avaliar o trabalhador');

    await user.click(screen.getByRole('button', { name: 'Agora não' }));

    expect(skipRatingMock).toHaveBeenCalledWith('shift-1');
    expect(await screen.findByText('Você optou por não avaliar esse profissional.')).toBeInTheDocument();
    expect(screen.queryByText('Avaliar o trabalhador')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Avaliar mesmo assim' }));

    expect(screen.getByText('Avaliar o trabalhador')).toBeInTheDocument();
  });

  it('mostra quantas vagas já foram preenchidas', async () => {
    listJobApplicationsMock.mockResolvedValue({
      applications: [
        { ...PENDING_APPLICATION, id: 'app-1', status: 'approved' },
        { ...PENDING_APPLICATION, id: 'app-2', status: 'approved' },
        { ...PENDING_APPLICATION, id: 'app-3', status: 'pending' },
      ],
    });
    listMyJobsMock.mockResolvedValue({
      jobs: [{ id: 'job-1', positionsTotal: 4, positionsFilled: 2 }],
    });

    render(<VagaCandidatosPage />);

    expect(await screen.findByText('2 de 4 vagas preenchidas')).toBeInTheDocument();
  });

  it('mostra os benefícios oferecidos pela vaga', async () => {
    listJobApplicationsMock.mockResolvedValue({ applications: [] });
    listMyJobsMock.mockResolvedValue({
      jobs: [
        {
          id: 'job-1',
          positionsTotal: 4,
          positionsFilled: 0,
          mealProvision: 'on_site',
          transportProvision: 'paid',
          transportAmount: '15.00',
          minorsAllowed: true,
        },
      ],
    });

    render(<VagaCandidatosPage />);

    expect(await screen.findByText('Alimentação no local')).toBeInTheDocument();
    expect(screen.getByText('Transporte: R$ 15,00')).toBeInTheDocument();
    expect(screen.getByText('Disponível pra menores de idade')).toBeInTheDocument();
  });

  it('não mostra o formulário quando o turno já foi avaliado', async () => {
    listJobApplicationsMock.mockResolvedValue({
      applications: [
        makeCompletedApplication({
          ratings: {
            worker: null,
            company: {
              id: 'rating-1',
              shiftId: 'shift-1',
              raterRole: 'company',
              score: 4,
              categoryScores: null,
              comment: null,
              createdAt: '2026-07-02T00:00:00.000Z',
            },
          },
        }),
      ],
    });

    render(<VagaCandidatosPage />);

    expect(await screen.findByText('Você avaliou: 4 de 5.')).toBeInTheDocument();
    expect(screen.queryByText('Avaliar o trabalhador')).not.toBeInTheDocument();
  });

  it('mostra erro (não "nenhuma pergunta") quando a busca de perguntas falha, e permite tentar de novo', async () => {
    listJobApplicationsMock.mockResolvedValue({ applications: [] });
    listJobQuestionsMock.mockRejectedValueOnce(new Error('falha de rede'));
    const user = userEvent.setup();

    render(<VagaCandidatosPage />);

    expect(await screen.findByText('Não foi possível carregar as perguntas.')).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma pergunta ainda.')).not.toBeInTheDocument();

    listJobQuestionsMock.mockResolvedValueOnce({ questions: [] });
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('Nenhuma pergunta ainda.')).toBeInTheDocument();
  });

  const APPROVED_CANDIDATE = {
    ...PENDING_APPLICATION,
    id: 'app-2',
    status: 'approved',
    worker: { ...PENDING_APPLICATION.worker, id: 'worker-2', fullName: 'Bruno Lima' },
    shift: { id: 'shift-1', status: 'scheduled', checkInAt: null, checkOutAt: null, payment: null, ratings: { worker: null, company: null } },
  };

  const REJECTED_CANDIDATE = {
    ...PENDING_APPLICATION,
    id: 'app-3',
    status: 'rejected',
    worker: { ...PENDING_APPLICATION.worker, id: 'worker-3', fullName: 'Carla Dias' },
  };

  it('não mostra abas quando não há nenhum candidato', async () => {
    listJobApplicationsMock.mockResolvedValue({ applications: [] });

    render(<VagaCandidatosPage />);

    await screen.findByText('Ninguém se candidatou a essa vaga ainda.');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('segmenta candidatos por aba, com contagem, e começa na aba Pendentes quando há pendente', async () => {
    listJobApplicationsMock.mockResolvedValue({
      applications: [PENDING_APPLICATION, APPROVED_CANDIDATE, REJECTED_CANDIDATE],
    });
    const user = userEvent.setup();

    render(<VagaCandidatosPage />);
    await screen.findByText('Ana Souza');

    expect(screen.getByRole('tab', { name: 'Pendentes (1)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('Bruno Lima')).not.toBeInTheDocument();
    expect(screen.queryByText('Carla Dias')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Aprovados (1)' }));

    expect(screen.getByText('Bruno Lima')).toBeInTheDocument();
    expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Recusados (1)' }));

    expect(screen.getByText('Carla Dias')).toBeInTheDocument();
    expect(screen.queryByText('Bruno Lima')).not.toBeInTheDocument();
  });

  it('começa na aba Aprovados quando não há nenhum pendente', async () => {
    listJobApplicationsMock.mockResolvedValue({ applications: [APPROVED_CANDIDATE, REJECTED_CANDIDATE] });

    render(<VagaCandidatosPage />);
    await screen.findByText('Bruno Lima');

    expect(screen.getByRole('tab', { name: 'Aprovados (1)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('Carla Dias')).not.toBeInTheDocument();
  });

  it('mostra mensagem específica quando a aba selecionada não tem candidato', async () => {
    listJobApplicationsMock.mockResolvedValue({ applications: [PENDING_APPLICATION] });
    const user = userEvent.setup();

    render(<VagaCandidatosPage />);
    await screen.findByText('Ana Souza');

    await user.click(screen.getByRole('tab', { name: 'Aprovados (0)' }));

    expect(await screen.findByText('Nenhum candidato aprovado ainda.')).toBeInTheDocument();
  });
});
