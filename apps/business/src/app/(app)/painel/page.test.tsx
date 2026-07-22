import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanyDashboard, CompanyProfileDetails } from '../../../lib/company-profile-api';
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
vi.mock('../../../lib/jobs-api', () => ({
  listMyJobs: (...args: unknown[]) => listMyJobsMock(...args),
}));

const listJobApplicationsMock = vi.fn();
vi.mock('../../../lib/applications-api', () => ({
  listJobApplications: (...args: unknown[]) => listJobApplicationsMock(...args),
}));

const getCompanyDashboardMock = vi.fn();
const getCompanyGrowthMetricsMock = vi.fn();
vi.mock('../../../lib/company-profile-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/company-profile-api')>();
  return {
    ...actual,
    getCompanyDashboard: (...args: unknown[]) => getCompanyDashboardMock(...args),
    getCompanyGrowthMetrics: (...args: unknown[]) => getCompanyGrowthMetricsMock(...args),
  };
});

// Cobertura com percentual definido (não nulo) por padrão — só "Mais
// contratado(a)" deveria mostrar "—" nos testes que não mexem nisso.
const DASHBOARD: CompanyDashboard = {
  coverage: { windowHours: 48, totalPositions: 4, filledPositions: 2, percentage: 50 },
  openPositionJobs: [],
  notifications: {
    pendingApplicationsCount: 0,
    pendingApplications: [],
    checkedInCount: 0,
    checkedInNotifications: [],
    checkedOutCount: 0,
    checkedOutNotifications: [],
    pendingRatingsCount: 0,
    pendingRatingsNotifications: [],
  },
};

const PROFILE: CompanyProfileDetails = {
  id: 'company-1',
  legalName: 'Bar do Zé Ltda',
  tradeName: 'Bar do Zé',
  personType: 'juridica',
  cnpj: '11222333000181',
  cpf: null,
  logoUrl: null,
  addressLabel: null,
  businessSegment: null,
  businessSegmentOther: null,
  verificationStatus: 'approved',
  rejectionReason: null,
  needsTermsAcceptance: false,
  hasAcceptedLoginTerms: true,
  avgRating: '4.8',
  avgCategoryScores: null,
  jobsPosted: 3,
  shiftsCompleted: 5,
  rehireRate: 20,
  jobsOpenedThisMonth: 4,
  workersHiredThisMonth: 3,
  topHiredWorkerName: 'Ana Souza',
  topHiredWorkerCount: 2,
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
    listJobApplicationsMock.mockReset().mockResolvedValue({ applications: [] });
    getCompanyDashboardMock.mockReset().mockResolvedValue(DASHBOARD);
    getCompanyGrowthMetricsMock.mockReset().mockResolvedValue({
      jobsPosted: [],
      workersHired: [],
      shiftsCompleted: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra chamada pra ação quando a empresa ainda não publicou nenhuma vaga', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [] });

    renderPainel();

    expect(await screen.findByText('Você ainda não publicou nenhuma escala')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Publicar vaga' })).toHaveAttribute('href', '/vagas/nova');
  });

  it('não mostra a chamada pra ação quando já existe alguma vaga', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });

    renderPainel();

    await screen.findByText('Escalas abertas');
    expect(screen.queryByText('Você ainda não publicou nenhuma escala')).not.toBeInTheDocument();
  });

  it('mostra o total investido no mês e escalas preenchidas na semana nas estatísticas', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [{ ...JOB, status: 'filled', positionsFilled: 4 }] });

    renderPainel();

    await screen.findByText('Escalas abertas');
    expect(screen.getByText('R$ 520,00')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  it('exclui vaga de outro mês do "Gasto no mês" (não soma tudo, só o mês atual)', async () => {
    listMyJobsMock.mockResolvedValue({
      jobs: [
        { ...JOB, id: 'job-current-month', status: 'filled', positionsFilled: 4 },
        {
          ...JOB,
          id: 'job-other-month',
          status: 'filled',
          positionsFilled: 10,
          payAmount: '999.00',
          startsAt: '2026-07-06T18:00:00.000Z',
          endsAt: '2026-07-06T23:00:00.000Z',
        },
      ],
    });

    renderPainel();

    await screen.findByText('Escalas abertas');
    // Se a vaga de julho entrasse na soma, daria muito mais que 520.
    expect(screen.getByText('R$ 520,00')).toBeInTheDocument();
  });

  it('mostra a avaliação da casa vinda do perfil da empresa', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [] });

    renderPainel();

    await screen.findByText('Escalas abertas');
    expect(screen.getByText('★ 4.8')).toBeInTheDocument();
  });

  it('mostra o resumo do mês vindo do perfil da empresa', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [] });

    renderPainel();

    expect(await screen.findByText('Resumo do mês')).toBeInTheDocument();
    expect(screen.getByText('Escalas abertas no mês')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Pessoas contratadas')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('2x esse mês')).toBeInTheDocument();
  });

  it('mostra travessão em "Mais contratado(a)" quando ninguém foi contratado no mês', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [] });

    renderPainel({ ...PROFILE, topHiredWorkerName: null, topHiredWorkerCount: 0 });

    await screen.findByText('Resumo do mês');
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('mostra a cobertura das próximas 48h vinda do dashboard', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [] });

    renderPainel();

    expect(await screen.findByText('50%')).toBeInTheDocument();
    expect(screen.getByText('2/4 posições preenchidas')).toBeInTheDocument();
  });

  it('mostra a central de ações com vagas de posição em aberto e candidatos aguardando', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });
    getCompanyDashboardMock.mockResolvedValue({
      ...DASHBOARD,
      openPositionJobs: [
        { jobId: 'job-2', categoryName: 'Garçom', startsAt: '2026-08-06T18:00:00.000Z', positionsTotal: 3, positionsFilled: 1, openPositions: 2 },
      ],
      notifications: {
        ...DASHBOARD.notifications,
        pendingApplicationsCount: 1,
        pendingApplications: [{ applicationId: 'app-2', jobId: 'job-2', workerName: 'Beatriz Lima', categoryName: 'Garçom' }],
      },
    });

    renderPainel();

    expect(await screen.findByText('Vagas com posição em aberto')).toBeInTheDocument();
    expect(screen.getByText(/2 posição\(ões\) em aberto/)).toBeInTheDocument();
    expect(screen.getByText('Candidatos aguardando resposta')).toBeInTheDocument();
    expect(screen.getByText(/Beatriz Lima aguardando resposta/)).toBeInTheDocument();
  });

  it('não falha a página inteira quando só o dashboard falha — vagas continuam aparecendo', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });
    getCompanyDashboardMock.mockRejectedValue(new Error('falha no dashboard'));

    renderPainel();

    await screen.findByText('Escalas abertas');
    expect(screen.queryByText('Não foi possível carregar suas escalas.')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument(); // Cobertura sem dado, sem travar o resto
  });

  it('mostra mensagem de erro quando a listagem falha', async () => {
    listMyJobsMock.mockRejectedValue(new Error('falha'));

    renderPainel();

    expect(await screen.findByText('Não foi possível carregar suas escalas.')).toBeInTheDocument();
  });

  it('mostra os gráficos de crescimento quando a API responde bem', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [] });
    getCompanyGrowthMetricsMock.mockResolvedValue({
      jobsPosted: [{ weekStart: '2026-07-06', count: 2 }],
      workersHired: [{ weekStart: '2026-07-06', count: 1 }],
      shiftsCompleted: [{ weekStart: '2026-07-06', count: 3 }],
    });

    renderPainel();

    expect(await screen.findByText('Vagas publicadas')).toBeInTheDocument();
    expect(screen.getByText('Trabalhadores contratados')).toBeInTheDocument();
    expect(screen.getByText('Escalas concluídas')).toBeInTheDocument();
  });

  it('não falha a página inteira quando só o crescimento falha — vagas continuam aparecendo', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [JOB] });
    getCompanyGrowthMetricsMock.mockRejectedValue(new Error('falha no crescimento'));

    renderPainel();

    await screen.findByText('Escalas abertas');
    expect(
      await screen.findByText('Não foi possível carregar os gráficos de crescimento.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Vagas publicadas')).not.toBeInTheDocument();
  });

  it('mostra o trabalhador aprovado em "Escalas confirmadas"', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [{ ...JOB, status: 'filled', positionsFilled: 4 }] });
    listJobApplicationsMock.mockResolvedValue({
      applications: [
        {
          id: 'app-1',
          status: 'approved',
          createdAt: '2026-08-01T00:00:00.000Z',
          worker: { id: 'w1', fullName: 'Rafael Lima', photoUrl: null, avgRating: '4.9' },
          shift: null,
        },
      ],
    });

    renderPainel();

    expect(await screen.findByText('Escalas confirmadas')).toBeInTheDocument();
    expect(screen.getByText('Rafael Lima')).toBeInTheDocument();
  });

  it('some de "Escalas confirmadas" quando o evento já aconteceu', async () => {
    const pastJob = {
      ...JOB,
      id: 'job-past',
      status: 'filled',
      positionsFilled: 4,
      startsAt: '2026-08-01T18:00:00.000Z',
      endsAt: '2026-08-01T23:00:00.000Z',
    };
    listMyJobsMock.mockResolvedValue({ jobs: [pastJob] });
    listJobApplicationsMock.mockResolvedValue({
      applications: [
        {
          id: 'app-1',
          status: 'approved',
          createdAt: '2026-07-25T00:00:00.000Z',
          worker: { id: 'w1', fullName: 'Ana Souza', photoUrl: null, avgRating: '4.9' },
          shift: null,
        },
      ],
    });

    renderPainel();

    await screen.findByText('Escalas abertas');
    expect(screen.queryByText('Escalas confirmadas')).not.toBeInTheDocument();
  });

  it('avisa de escala concluída esperando avaliação da empresa', async () => {
    const pastJob = { ...JOB, id: 'job-past', status: 'filled', positionsFilled: 1 };
    listMyJobsMock.mockResolvedValue({ jobs: [pastJob] });
    listJobApplicationsMock.mockResolvedValue({
      applications: [
        {
          id: 'app-1',
          status: 'approved',
          createdAt: '2026-08-01T00:00:00.000Z',
          worker: { id: 'w1', fullName: 'Rafael Lima', photoUrl: null, avgRating: '4.9' },
          shift: { id: 'shift-1', status: 'completed', checkInAt: null, checkOutAt: null, payment: null, ratings: { worker: null, company: null } },
        },
      ],
    });

    renderPainel();

    expect(await screen.findByText('1 escala concluída esperando sua avaliação')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /avalie rafael lima/i });
    expect(link).toHaveAttribute('href', '/vagas/job-past');
  });

  it('não avisa quando a escala concluída já foi avaliada pela empresa', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [{ ...JOB, status: 'filled', positionsFilled: 1 }] });
    listJobApplicationsMock.mockResolvedValue({
      applications: [
        {
          id: 'app-1',
          status: 'approved',
          createdAt: '2026-08-01T00:00:00.000Z',
          worker: { id: 'w1', fullName: 'Rafael Lima', photoUrl: null, avgRating: '4.9' },
          shift: {
            id: 'shift-1',
            status: 'completed',
            checkInAt: null,
            checkOutAt: null,
            payment: null,
            ratings: { worker: null, company: { id: 'r1', shiftId: 'shift-1', raterRole: 'company', score: 5, categoryScores: null, comment: null, createdAt: '2026-08-02T00:00:00.000Z' } },
          },
        },
      ],
    });

    renderPainel();

    await screen.findByText('Escalas abertas');
    expect(screen.queryByText(/esperando sua avaliação/)).not.toBeInTheDocument();
  });
});
