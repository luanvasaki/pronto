import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EditarVagaPage from './page';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useParams: () => ({ id: 'job-1' }),
}));

const listSkillCategoriesMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    getCurrentUser: vi.fn().mockResolvedValue({ user: { id: '1' } }),
    listSkillCategories: (...args: unknown[]) => listSkillCategoriesMock(...args),
  };
});

const listMyJobsMock = vi.fn();
const updateJobMock = vi.fn();
vi.mock('../../../../../lib/jobs-api', () => ({
  listMyJobs: (...args: unknown[]) => listMyJobsMock(...args),
  updateJob: (...args: unknown[]) => updateJobMock(...args),
}));

// Mesma conversão que o componente deveria fazer pro <input
// type="datetime-local">: se ele voltar a só cortar a string ISO
// (`.slice(0, 16)`), os testes que usam isso falham em qualquer fuso
// diferente de UTC (este ambiente roda em UTC-3).
function toLocalDateTimeInput(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

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
  startsAt: '2026-08-01T18:00:00.000Z',
  endsAt: '2026-08-01T23:00:00.000Z',
  applicationsCloseAt: null,
  status: 'open',
};

describe('EditarVagaPage', () => {
  beforeEach(() => {
    listSkillCategoriesMock.mockReset().mockResolvedValue({ categories: [{ id: 'cat-1', name: 'Garçom' }] });
    listMyJobsMock.mockReset();
    updateJobMock.mockReset();
    pushMock.mockReset();
  });

  it('pré-preenche o formulário com os dados atuais da vaga', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });

    render(<EditarVagaPage />);

    expect(await screen.findByDisplayValue('Vaga de garçom pra evento')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Vila Madalena, São Paulo')).toBeInTheDocument();
    expect(screen.getByDisplayValue('130.00')).toBeInTheDocument();
  });

  it('converte início/término de UTC pro fuso local, não só corta a string', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });

    render(<EditarVagaPage />);
    await screen.findByDisplayValue('Vaga de garçom pra evento');

    expect(screen.getByDisplayValue(toLocalDateTimeInput(JOB.startsAt))).toBeInTheDocument();
    expect(screen.getByDisplayValue(toLocalDateTimeInput(JOB.endsAt))).toBeInTheDocument();
  });

  it('pré-preenche experiência, vestimenta e ferramentas exigidas', async () => {
    listMyJobsMock.mockResolvedValue({
      jobs: [{ ...JOB, requiresExperience: true, dressCode: 'Social completo', toolsRequired: 'Câmera própria' }],
    });

    render(<EditarVagaPage />);

    await screen.findByDisplayValue('Vaga de garçom pra evento');
    expect(screen.getByRole('button', { name: 'Sim' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Não' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByDisplayValue('Social completo')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Câmera própria')).toBeInTheDocument();
  });

  it('mostra o que falta preencher quando o botão de salvar está desabilitado', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });
    const user = userEvent.setup();

    render(<EditarVagaPage />);
    await screen.findByDisplayValue('Vaga de garçom pra evento');

    await user.clear(screen.getByLabelText('Descrição'));

    expect(screen.getByText(/falta preencher:/i)).toHaveTextContent(/descrição/i);
    expect(screen.getByRole('button', { name: /salvar alterações/i })).toBeDisabled();
  });

  it('mostra erro quando a vaga não é encontrada', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [] });

    render(<EditarVagaPage />);

    expect(await screen.findByText('Vaga não encontrada.')).toBeInTheDocument();
  });

  it('mostra erro quando a vaga não está mais aberta', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [{ ...JOB, status: 'filled' }] });

    render(<EditarVagaPage />);

    expect(await screen.findByText('Só é possível editar vagas abertas.')).toBeInTheDocument();
  });

  it('salva as alterações e volta pro painel', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });
    updateJobMock.mockResolvedValue({ ...JOB, payAmount: '150.00' });
    const user = userEvent.setup();

    render(<EditarVagaPage />);
    await screen.findByDisplayValue('130.00');
    const payInput = screen.getByLabelText('Valor por pessoa (R$)');
    await user.clear(payInput);
    await user.type(payInput, '150.00');
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    await waitFor(() => expect(updateJobMock).toHaveBeenCalled());
    expect(updateJobMock.mock.calls[0][0]).toBe('job-1');
    expect(updateJobMock.mock.calls[0][1]).toMatchObject({ payAmount: '150.00', applicationsCloseAt: undefined });
    expect(pushMock).toHaveBeenCalledWith('/painel');
  });

  it('pré-preenche o prazo de candidatura quando a vaga já tem um escolhido', async () => {
    const applicationsCloseAt = '2026-08-01T15:00:00.000Z';
    listMyJobsMock.mockResolvedValue({ jobs: [{ ...JOB, applicationsCloseAt }] });

    render(<EditarVagaPage />);

    await screen.findByDisplayValue('Vaga de garçom pra evento');
    expect(screen.getByLabelText(/fechar candidaturas em/i)).toHaveValue(toLocalDateTimeInput(applicationsCloseAt));
  });

  it('pré-preenche mealProvision/transportProvision/minorsAllowed com os dados atuais da vaga', async () => {
    listMyJobsMock.mockResolvedValue({
      jobs: [
        {
          ...JOB,
          mealProvision: 'paid',
          mealAmount: '20.00',
          transportProvision: 'on_site',
          transportAmount: null,
          minorsAllowed: true,
        },
      ],
    });

    render(<EditarVagaPage />);
    await screen.findByDisplayValue('Vaga de garçom pra evento');

    expect(screen.getByLabelText(/vaga disponível pra menores de idade/i)).toBeChecked();
    expect(screen.getByLabelText(/valor da alimentação/i)).toHaveValue('20.00');
    expect(screen.getAllByRole('button', { name: 'No local' })[1]).toHaveAttribute('aria-pressed', 'true');
  });

  it('salva as mudanças de benefícios e de minorsAllowed', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });
    updateJobMock.mockResolvedValue(JOB);
    const user = userEvent.setup();

    render(<EditarVagaPage />);
    await screen.findByDisplayValue('130.00');

    const mealButtons = screen.getAllByRole('button', { name: 'Por um valor' });
    await user.click(mealButtons[0]);
    await user.type(screen.getByLabelText(/valor da alimentação/i), '20,00');
    await user.click(screen.getByLabelText(/vaga disponível pra menores de idade/i));
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    await waitFor(() => expect(updateJobMock).toHaveBeenCalled());
    expect(updateJobMock.mock.calls[0][1]).toMatchObject({
      mealProvision: 'paid',
      mealAmount: '20.00',
      minorsAllowed: true,
    });
  });

  it('envia o novo prazo de candidatura quando alterado', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });
    updateJobMock.mockResolvedValue(JOB);
    const user = userEvent.setup();

    // Precisa ser antes do início da vaga (18:00 UTC) — 2h antes, convertido
    // pro mesmo fuso local que o campo usa, pra não depender do fuso da
    // máquina que roda o teste.
    const closeAtIso = new Date(new Date(JOB.startsAt).getTime() - 2 * 60 * 60 * 1000).toISOString();
    const closeAtLocal = toLocalDateTimeInput(closeAtIso);

    render(<EditarVagaPage />);
    await screen.findByDisplayValue('130.00');
    await user.type(screen.getByLabelText(/fechar candidaturas em/i), closeAtLocal);
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    await waitFor(() => expect(updateJobMock).toHaveBeenCalled());
    expect(updateJobMock.mock.calls[0][1]).toMatchObject({
      applicationsCloseAt: new Date(closeAtLocal).toISOString(),
    });
  });
});
