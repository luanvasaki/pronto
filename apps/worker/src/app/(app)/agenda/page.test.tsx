import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AgendaPage from './page';

const listSkillCategoriesMock = vi.fn();
const rateShiftMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    listSkillCategories: (...args: unknown[]) => listSkillCategoriesMock(...args),
    rateShift: (...args: unknown[]) => rateShiftMock(...args),
  };
});

const listMyShiftsMock = vi.fn();
const checkInMock = vi.fn();
const checkOutMock = vi.fn();
const confirmPaymentMock = vi.fn();
vi.mock('../../../lib/shifts-api', () => ({
  listMyShifts: (...args: unknown[]) => listMyShiftsMock(...args),
  checkIn: (...args: unknown[]) => checkInMock(...args),
  checkOut: (...args: unknown[]) => checkOutMock(...args),
  confirmPayment: (...args: unknown[]) => confirmPaymentMock(...args),
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
    job: typeof JOB;
    companyName: string;
    payment: { id: string; shiftId: string; amount: string; status: string; chargedAt: string | null; releasedAt: string | null } | null;
    ratings: {
      worker:
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
      company: unknown;
    };
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
    companyName: 'Buffet Aurora',
    payment: null,
    ratings: { worker: null, company: null },
    ...overrides,
  };
}

describe('AgendaPage', () => {
  beforeEach(() => {
    listSkillCategoriesMock.mockReset().mockResolvedValue({ categories: [{ id: 'cat-1', name: 'Garçom' }] });
    listMyShiftsMock.mockReset();
    checkInMock.mockReset();
    checkOutMock.mockReset();
    rateShiftMock.mockReset();
    confirmPaymentMock.mockReset();
    Object.defineProperty(window.navigator, 'geolocation', { value: undefined, configurable: true });
  });

  it('mostra estado vazio quando não há escalas', async () => {
    listMyShiftsMock.mockResolvedValue({ shifts: [] });

    render(<AgendaPage />);

    expect(await screen.findByText('Você ainda não tem escalas agendadas.')).toBeInTheDocument();
  });

  it('mostra o resumo de escalas agendadas e concluídas', async () => {
    listMyShiftsMock.mockResolvedValue({
      shifts: [makeShift({ status: 'scheduled' }), makeShift({ status: 'checked_in' }), makeShift({ status: 'completed' })],
    });

    render(<AgendaPage />);

    await screen.findByText('Minhas escalas');
    expect(screen.getByText('Agendadas').previousElementSibling).toHaveTextContent('2');
    expect(screen.getByText('Já concluídas').previousElementSibling).toHaveTextContent('1');
  });

  it('mostra o calendário com um ponto por escala do mês, e o endereço ao clicar num dia com escala concluída', async () => {
    const now = new Date();
    const dayInMonth = now.getDate() <= 20 ? now.getDate() + 5 : now.getDate() - 5;
    const dateInCurrentMonth = new Date(now.getFullYear(), now.getMonth(), dayInMonth, 18, 0).toISOString();

    listMyShiftsMock.mockResolvedValue({
      shifts: [
        makeShift({
          status: 'completed',
          job: { ...JOB, startsAt: dateInCurrentMonth, endsAt: dateInCurrentMonth },
        }),
      ],
    });
    const user = userEvent.setup();

    render(<AgendaPage />);
    await screen.findByText('Minhas escalas');

    const dayButtons = screen.getAllByRole('button', { name: String(dayInMonth) });
    const dayButton = dayButtons.find((button) => !button.hasAttribute('disabled'));
    expect(dayButton).toBeDefined();
    await user.click(dayButton!);

    // O endereço aparece duas vezes: no painel do dia selecionado no
    // calendário, e na lista detalhada mais abaixo (ambos mostram a
    // mesma escala concluída).
    expect(await screen.findAllByRole('link', { name: 'Vila Madalena, São Paulo' })).toHaveLength(2);
    // Mesma lógica pro nome da empresa.
    expect(screen.getAllByText('Buffet Aurora')).toHaveLength(2);
  });

  it('mostra o botão de check-in pra turno agendado', async () => {
    listMyShiftsMock.mockResolvedValue({ shifts: [makeShift({ status: 'scheduled' })] });

    render(<AgendaPage />);

    expect(await screen.findByText('Agendado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fazer check-in/i })).toBeInTheDocument();
  });

  it('mostra o botão de check-out pra turno em andamento', async () => {
    listMyShiftsMock.mockResolvedValue({ shifts: [makeShift({ status: 'checked_in' })] });

    render(<AgendaPage />);

    expect((await screen.findAllByText('Em andamento')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /fazer check-out/i })).toBeInTheDocument();
  });

  it('não mostra botão de check-in/check-out pra turno concluído', async () => {
    listMyShiftsMock.mockResolvedValue({ shifts: [makeShift({ status: 'completed' })] });

    render(<AgendaPage />);

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

    render(<AgendaPage />);

    expect(await screen.findByText(/acerte o pagamento direto com a empresa/i)).toBeInTheDocument();
  });

  it('mostra o formulário de avaliação pra turno concluído ainda não avaliado', async () => {
    listMyShiftsMock.mockResolvedValue({ shifts: [makeShift({ status: 'completed' })] });

    render(<AgendaPage />);

    expect(await screen.findByText('Avaliar a empresa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pontualidade no pagamento: 5 de 5' })).toBeInTheDocument();
  });

  it('envia a avaliação só depois de preencher as 5 categorias', async () => {
    listMyShiftsMock.mockResolvedValue({ shifts: [makeShift({ status: 'completed' })] });
    rateShiftMock.mockResolvedValue({
      id: 'rating-1',
      shiftId: 'shift-1',
      raterRole: 'worker',
      score: 4,
      categoryScores: {
        pontualidade_pagamento: 4,
        clareza_vaga: 4,
        respeito: 4,
        comunicacao: 4,
        ambiente: 4,
      },
      comment: null,
      createdAt: '2026-08-02T00:00:00.000Z',
    });
    const user = userEvent.setup();

    render(<AgendaPage />);
    await screen.findByText('Avaliar a empresa');

    expect(screen.getByRole('button', { name: /enviar avaliação/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Pontualidade no pagamento: 4 de 5' }));
    await user.click(screen.getByRole('button', { name: 'Clareza das informações da vaga: 4 de 5' }));
    await user.click(screen.getByRole('button', { name: 'Respeito no tratamento: 4 de 5' }));
    await user.click(screen.getByRole('button', { name: 'Comunicação: 4 de 5' }));
    await user.click(screen.getByRole('button', { name: 'Ambiente e condições de trabalho: 4 de 5' }));
    await user.click(screen.getByRole('button', { name: /enviar avaliação/i }));

    await waitFor(() =>
      expect(rateShiftMock).toHaveBeenCalledWith(
        'shift-1',
        {
          pontualidade_pagamento: 4,
          clareza_vaga: 4,
          respeito: 4,
          comunicacao: 4,
          ambiente: 4,
        },
        undefined,
      ),
    );
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
              categoryScores: null,
              comment: null,
              createdAt: '2026-08-02T00:00:00.000Z',
            },
            company: null,
          },
        }),
      ],
    });

    render(<AgendaPage />);

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

    render(<AgendaPage />);
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

    render(<AgendaPage />);
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

    render(<AgendaPage />);
    await screen.findByRole('button', { name: /fazer check-out/i });
    await user.click(screen.getByRole('button', { name: /fazer check-out/i }));

    expect(await screen.findByText(/acerte o pagamento direto com a empresa/i)).toBeInTheDocument();
    expect(listMyShiftsMock).toHaveBeenCalledTimes(2);
  });

  it('mostra os botões de confirmar/contestar quando a empresa marca como pago', async () => {
    listMyShiftsMock.mockResolvedValue({
      shifts: [
        makeShift({
          status: 'completed',
          payment: { id: 'p1', shiftId: 'shift-1', amount: '130.00', status: 'released', chargedAt: null, releasedAt: null },
        }),
      ],
    });

    render(<AgendaPage />);

    expect(await screen.findByRole('button', { name: /recebi o pagamento/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /não recebi/i })).toBeInTheDocument();
  });

  it('confirma o recebimento e atualiza o status', async () => {
    listMyShiftsMock.mockResolvedValue({
      shifts: [
        makeShift({
          status: 'completed',
          payment: { id: 'p1', shiftId: 'shift-1', amount: '130.00', status: 'released', chargedAt: null, releasedAt: null },
        }),
      ],
    });
    confirmPaymentMock.mockResolvedValue({
      id: 'p1',
      shiftId: 'shift-1',
      amount: '130.00',
      status: 'confirmed',
      chargedAt: null,
      releasedAt: null,
    });
    const user = userEvent.setup();

    render(<AgendaPage />);
    await user.click(await screen.findByRole('button', { name: /recebi o pagamento/i }));

    expect(confirmPaymentMock).toHaveBeenCalledWith('shift-1', true);
    expect(await screen.findByText('Você confirmou o recebimento')).toBeInTheDocument();
  });

  it('contesta o recebimento e mostra o status em disputa', async () => {
    listMyShiftsMock.mockResolvedValue({
      shifts: [
        makeShift({
          status: 'completed',
          payment: { id: 'p1', shiftId: 'shift-1', amount: '130.00', status: 'released', chargedAt: null, releasedAt: null },
        }),
      ],
    });
    confirmPaymentMock.mockResolvedValue({
      id: 'p1',
      shiftId: 'shift-1',
      amount: '130.00',
      status: 'disputed',
      chargedAt: null,
      releasedAt: null,
    });
    const user = userEvent.setup();

    render(<AgendaPage />);
    await user.click(await screen.findByRole('button', { name: /não recebi/i }));

    expect(confirmPaymentMock).toHaveBeenCalledWith('shift-1', false);
    expect(await screen.findByText(/você avisou que não recebeu/i)).toBeInTheDocument();
  });

  it('só o botão clicado entra em loading — o outro continua clicável', async () => {
    listMyShiftsMock.mockResolvedValue({
      shifts: [
        makeShift({
          status: 'completed',
          payment: { id: 'p1', shiftId: 'shift-1', amount: '130.00', status: 'released', chargedAt: null, releasedAt: null },
        }),
      ],
    });
    let resolveConfirm: (value: {
      id: string;
      shiftId: string;
      amount: string;
      status: string;
      chargedAt: string | null;
      releasedAt: string | null;
    }) => void = () => {};
    confirmPaymentMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveConfirm = resolve;
        }),
    );
    const user = userEvent.setup();

    render(<AgendaPage />);
    const confirmButton = await screen.findByRole('button', { name: /recebi o pagamento/i });
    const disputeButton = screen.getByRole('button', { name: /não recebi/i });

    await user.click(confirmButton);

    // O botão clicado mostra loading (fica desabilitado por causa disso).
    expect(confirmButton).toBeDisabled();
    // O outro botão fica desabilitado pra evitar clique duplo enquanto a
    // primeira ação está em andamento, mas não deveria mostrar spinner —
    // spinner é um <span aria-hidden> renderizado só quando isLoading é true.
    expect(disputeButton).toBeDisabled();
    expect(disputeButton.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();
    expect(confirmButton.querySelector('[aria-hidden="true"]')).toBeInTheDocument();

    resolveConfirm({ id: 'p1', shiftId: 'shift-1', amount: '130.00', status: 'confirmed', chargedAt: null, releasedAt: null });
    expect(await screen.findByText('Você confirmou o recebimento')).toBeInTheDocument();
  });

  it('mostra a mensagem da API quando a confirmação falha', async () => {
    listMyShiftsMock.mockResolvedValue({
      shifts: [
        makeShift({
          status: 'completed',
          payment: { id: 'p1', shiftId: 'shift-1', amount: '130.00', status: 'released', chargedAt: null, releasedAt: null },
        }),
      ],
    });
    confirmPaymentMock.mockRejectedValue(new Error('falha de rede'));
    const user = userEvent.setup();

    render(<AgendaPage />);
    await user.click(await screen.findByRole('button', { name: /recebi o pagamento/i }));

    expect(await screen.findByText('falha de rede')).toBeInTheDocument();
  });
});
