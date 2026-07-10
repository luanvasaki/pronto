import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanyProfileDetails } from '../../../lib/company-profile-api';
import { CompanyProfileProvider } from '../company-profile-context';
import PainelPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
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
const cancelJobMock = vi.fn();
vi.mock('../../../lib/jobs-api', () => ({
  listMyJobs: (...args: unknown[]) => listMyJobsMock(...args),
  cancelJob: (...args: unknown[]) => cancelJobMock(...args),
}));

const listJobApplicationsMock = vi.fn();
vi.mock('../../../lib/applications-api', () => ({
  listJobApplications: (...args: unknown[]) => listJobApplicationsMock(...args),
}));

const PROFILE: CompanyProfileDetails = {
  id: 'company-1',
  legalName: 'Bar do Zé Ltda',
  tradeName: 'Bar do Zé',
  cnpj: '11222333000181',
  logoUrl: null,
  addressLabel: null,
  businessSegment: null,
  verificationStatus: 'approved',
  avgRating: '4.8',
  avgCategoryScores: null,
  totalJobsPosted: 3,
  jobsPosted: 3,
  shiftsCompleted: 5,
  rehireRate: 20,
};

// Quarta-feira, dentro da semana e do mês usados nas vagas de teste.
const NOW = new Date('2026-08-05T12:00:00.000Z');

const JOB = {
  id: 'job-1',
  categoryId: 'cat-1',
  description: 'Vaga de garçom pra evento',
  addressLabel: 'Vila Madalena, São Paulo',
  locationLat: -23.55,
  locationLng: -46.63,
  positionsTotal: 4,
  positionsFilled: 1,
  payAmount: '130.00',
  startsAt: '2026-08-06T18:00:00.000Z',
  endsAt: '2026-08-06T23:00:00.000Z',
  status: 'open',
};

function renderPainel(profile: CompanyProfileDetails | null = PROFILE) {
  return render(
    <CompanyProfileProvider initialProfile={profile}>
      <PainelPage />
    </CompanyProfileProvider>,
  );
}

describe('PainelPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
    listSkillCategoriesMock.mockReset().mockResolvedValue({ categories: [{ id: 'cat-1', name: 'Garçom' }] });
    listMyJobsMock.mockReset();
    cancelJobMock.mockReset();
    listJobApplicationsMock.mockReset().mockResolvedValue({ applications: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra estado vazio em "Precisam de gente" quando não há vaga aberta', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [] });

    renderPainel();

    expect(await screen.findByText(/tudo coberto por aqui/i)).toBeInTheDocument();
  });

  it('mostra a vaga aberta com categoria, horário e candidatos pendentes', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });
    listJobApplicationsMock.mockResolvedValue({
      applications: [
        { id: 'app-1', status: 'pending', createdAt: '2026-08-01T00:00:00.000Z', worker: { id: 'w1', fullName: 'Ana Souza', photoUrl: null, avgRating: null }, shift: null },
      ],
    });

    renderPainel();

    expect(await screen.findByText(/Garçom · 3 vaga\(s\)/)).toBeInTheDocument();
    expect(screen.getByText(/R\$ 130.00 por pessoa/)).toBeInTheDocument();
    expect(screen.getByText('1 candidatos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver candidatos/i })).toHaveAttribute('href', '/vagas/job-1');
  });

  it('mostra o total investido no mês e turnos confirmados na semana nas estatísticas', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [{ ...JOB, status: 'filled', positionsFilled: 4 }] });

    renderPainel();

    await screen.findByText('Turnos abertos');
    expect(screen.getByText('R$ 520,00')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  it('mostra a avaliação da casa vinda do perfil da empresa', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [] });

    renderPainel();

    await screen.findByText('Turnos abertos');
    expect(screen.getByText('★ 4.8')).toBeInTheDocument();
  });

  it('mostra link de editar só pra vaga aberta', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB, { ...JOB, id: 'job-2', status: 'filled' }] });

    renderPainel();

    await screen.findAllByText(/Garçom/);
    expect(screen.getAllByRole('link', { name: /editar/i })).toHaveLength(1);
  });

  it('cancela a vaga e some da lista de abertas', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });
    cancelJobMock.mockResolvedValue({ ...JOB, status: 'cancelled' });
    const user = userEvent.setup();

    renderPainel();
    await screen.findByText(/Garçom/);
    await user.click(screen.getByRole('button', { name: /cancelar vaga/i }));

    await waitFor(() => expect(cancelJobMock).toHaveBeenCalledWith('job-1'));
    expect(await screen.findByText(/tudo coberto por aqui/i)).toBeInTheDocument();
  });

  it('mostra a mensagem da API quando o cancelamento falha', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });
    cancelJobMock.mockRejectedValue(new Error('falha de rede'));
    const user = userEvent.setup();

    renderPainel();
    await screen.findByText(/Garçom/);
    await user.click(screen.getByRole('button', { name: /cancelar vaga/i }));

    expect(await screen.findByText('Não foi possível cancelar a vaga.')).toBeInTheDocument();
  });

  it('mostra mensagem de erro quando a listagem falha', async () => {
    listMyJobsMock.mockRejectedValue(new Error('falha'));

    renderPainel();

    expect(await screen.findByText('Não foi possível carregar suas vagas.')).toBeInTheDocument();
  });

  it('mostra o trabalhador aprovado em "Turnos confirmados"', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [{ ...JOB, status: 'filled', positionsFilled: 4 }] });
    listJobApplicationsMock.mockResolvedValue({
      applications: [
        {
          id: 'app-1',
          status: 'approved',
          createdAt: '2026-08-01T00:00:00.000Z',
          worker: { id: 'w1', fullName: 'Ana Souza', photoUrl: null, avgRating: '4.9' },
          shift: null,
        },
      ],
    });

    renderPainel();

    expect(await screen.findByText('Turnos confirmados')).toBeInTheDocument();
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
  });
});
