import { ApiError } from '@shift/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VagaDetalhePage from './page';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'job-1' }),
}));

vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    listSkillCategories: (...args: unknown[]) => listSkillCategoriesMock(...args),
  };
});

const listSkillCategoriesMock = vi.fn();
const getJobDetailMock = vi.fn();
const applyToJobMock = vi.fn();
vi.mock('../../../../lib/jobs-api', () => ({
  getJobDetail: (...args: unknown[]) => getJobDetailMock(...args),
  applyToJob: (...args: unknown[]) => applyToJobMock(...args),
}));

const listJobAnnouncementsMock = vi.fn();
vi.mock('../../../../lib/announcements-api', () => ({
  listJobAnnouncements: (...args: unknown[]) => listJobAnnouncementsMock(...args),
}));

const listJobQuestionsMock = vi.fn();
const askQuestionMock = vi.fn();
vi.mock('../../../../lib/questions-api', () => ({
  listJobQuestions: (...args: unknown[]) => listJobQuestionsMock(...args),
  askQuestion: (...args: unknown[]) => askQuestionMock(...args),
}));

const JOB: Awaited<ReturnType<typeof getJobDetailMock>> = {
  id: 'job-1',
  categoryId: 'cat-1',
  description: 'Descrição bem detalhada da vaga de garçom.',
  requiresExperience: false,
  dressCode: null,
  toolsRequired: null,
  cnhCategory: null,
  cnhRequired: false,
  offersMeal: true,
  offersTransport: false,
  addressLabel: 'Vila Madalena, São Paulo',
  locationLat: -23.55,
  locationLng: -46.63,
  positionsTotal: 2,
  positionsFilled: 0,
  payAmount: '130.00',
  startsAt: '2026-08-06T18:00:00.000Z',
  endsAt: '2026-08-06T23:00:00.000Z',
  applicationsCloseAt: null,
  status: 'open',
  companyName: 'Bar do Zé',
  companyLogoUrl: null,
  companyAvgRating: null,
  matchesSkills: true,
  experienceMismatch: false,
  cnhMismatch: false,
  hasApplied: false,
};

describe('VagaDetalhePage', () => {
  beforeEach(() => {
    listSkillCategoriesMock.mockReset().mockResolvedValue({ categories: [{ id: 'cat-1', name: 'Garçom' }] });
    getJobDetailMock.mockReset().mockResolvedValue(JOB);
    applyToJobMock.mockReset();
    listJobAnnouncementsMock.mockReset().mockResolvedValue({ announcements: [] });
    listJobQuestionsMock.mockReset().mockResolvedValue({ questions: [] });
    askQuestionMock.mockReset();
  });

  it('mostra a descrição completa da vaga', async () => {
    render(<VagaDetalhePage />);

    expect(await screen.findByText('Descrição bem detalhada da vaga de garçom.')).toBeInTheDocument();
    expect(screen.getByText('Garçom')).toBeInTheDocument();
    expect(screen.getByText('Alimentação')).toBeInTheDocument();
  });

  it('não busca avisos/perguntas antes de se candidatar', async () => {
    render(<VagaDetalhePage />);

    await screen.findByText('Descrição bem detalhada da vaga de garçom.');
    expect(listJobAnnouncementsMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Avisos da empresa')).not.toBeInTheDocument();
  });

  it('mantém "Aceitar escala" desabilitado até confirmar o aceite dos termos', async () => {
    render(<VagaDetalhePage />);

    expect(await screen.findByRole('button', { name: 'Aceitar escala' })).toBeDisabled();
  });

  it('nunca destrava "Aceitar escala" quando a vaga exige CNH que o trabalhador não tem, mesmo confirmando os termos', async () => {
    getJobDetailMock.mockReset().mockResolvedValue({
      ...JOB,
      cnhMismatch: true,
      cnhRequired: true,
      cnhCategory: 'B',
    });
    const user = userEvent.setup();

    render(<VagaDetalhePage />);
    expect(
      await screen.findByText(/Essa vaga exige CNH categoria B — você não tem essa categoria no perfil/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox'));

    expect(screen.getByRole('button', { name: 'Aceitar escala' })).toBeDisabled();
  });

  it('deixa candidatar quando a CNH é só preferência (cnhRequired: false), mesmo com cnhMismatch', async () => {
    getJobDetailMock.mockReset().mockResolvedValue({
      ...JOB,
      cnhMismatch: true,
      cnhRequired: false,
      cnhCategory: 'B',
    });
    const user = userEvent.setup();

    render(<VagaDetalhePage />);
    expect(
      await screen.findByText(/Essa vaga prefere CNH categoria B — você pode se candidatar mesmo assim/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox'));

    expect(screen.getByRole('button', { name: 'Aceitar escala' })).toBeEnabled();
  });

  it('exige marcar a confirmação de experiência (além dos termos) quando experienceMismatch é true', async () => {
    getJobDetailMock.mockReset().mockResolvedValue({ ...JOB, experienceMismatch: true });
    const user = userEvent.setup();

    render(<VagaDetalhePage />);
    const checkboxes = await screen.findAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);

    // Só marcar os termos não é suficiente — falta a confirmação de experiência.
    await user.click(checkboxes[1]);
    expect(screen.getByRole('button', { name: 'Aceitar escala' })).toBeDisabled();

    await user.click(checkboxes[0]);
    expect(screen.getByRole('button', { name: 'Aceitar escala' })).toBeEnabled();
  });

  it('candidata-se e passa a mostrar avisos e perguntas', async () => {
    applyToJobMock.mockResolvedValue({ id: 'app-1' });
    const user = userEvent.setup();

    render(<VagaDetalhePage />);
    await user.click(await screen.findByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Aceitar escala' }));

    await waitFor(() => expect(applyToJobMock).toHaveBeenCalledWith('job-1'));
    expect(await screen.findByText('Candidatura enviada ✓')).toBeInTheDocument();
    await waitFor(() => expect(listJobAnnouncementsMock).toHaveBeenCalledWith('job-1'));
  });

  it('mostra o erro da API e não marca como candidatado quando a candidatura falha', async () => {
    applyToJobMock.mockRejectedValue(new ApiError(400, 'Essa vaga já está preenchida.'));
    const user = userEvent.setup();

    render(<VagaDetalhePage />);
    await user.click(await screen.findByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Aceitar escala' }));

    expect(await screen.findByText('Essa vaga já está preenchida.')).toBeInTheDocument();
    expect(screen.queryByText('Candidatura enviada ✓')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aceitar escala' })).toBeInTheDocument();
  });

  it('já mostra avisos/perguntas de cara quando já se candidatou (hasApplied)', async () => {
    getJobDetailMock.mockResolvedValue({ ...JOB, hasApplied: true });
    listJobAnnouncementsMock.mockResolvedValue({
      announcements: [{ id: 'a-1', jobId: 'job-1', message: 'Chegar 15 min antes', createdAt: '2026-07-01T10:00:00.000Z' }],
    });

    render(<VagaDetalhePage />);

    expect(await screen.findByText('Chegar 15 min antes')).toBeInTheDocument();
  });

  it('envia uma pergunta pra empresa', async () => {
    getJobDetailMock.mockResolvedValue({ ...JOB, hasApplied: true });
    askQuestionMock.mockResolvedValue({
      id: 'q-1',
      jobId: 'job-1',
      question: 'Tem vestiário?',
      answer: null,
      answeredAt: null,
      createdAt: '2026-07-01T10:00:00.000Z',
      worker: { id: 'worker-1', fullName: 'Ana Souza' },
    });
    const user = userEvent.setup();

    render(<VagaDetalhePage />);
    await screen.findByText('Perguntas e respostas');
    await user.type(screen.getByPlaceholderText('Faça uma pergunta pra empresa...'), 'Tem vestiário?');
    await user.click(screen.getByRole('button', { name: 'Perguntar' }));

    await waitFor(() => expect(askQuestionMock).toHaveBeenCalledWith('job-1', 'Tem vestiário?'));
    expect(await screen.findByText('Tem vestiário?')).toBeInTheDocument();
  });

  it('mostra erro (não "nenhum aviso") quando a busca de avisos falha, e permite tentar de novo', async () => {
    getJobDetailMock.mockResolvedValue({ ...JOB, hasApplied: true });
    listJobAnnouncementsMock.mockRejectedValueOnce(new Error('falha de rede'));
    const user = userEvent.setup();

    render(<VagaDetalhePage />);

    expect(await screen.findByText('Não foi possível carregar os avisos.')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum aviso ainda.')).not.toBeInTheDocument();

    listJobAnnouncementsMock.mockResolvedValueOnce({ announcements: [] });
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('Nenhum aviso ainda.')).toBeInTheDocument();
  });
});
