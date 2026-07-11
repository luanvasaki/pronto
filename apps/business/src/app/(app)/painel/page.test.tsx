import { render, screen } from '@testing-library/react';
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
vi.mock('../../../lib/jobs-api', () => ({
  listMyJobs: (...args: unknown[]) => listMyJobsMock(...args),
}));

const listJobApplicationsMock = vi.fn();
vi.mock('../../../lib/applications-api', () => ({
  listJobApplications: (...args: unknown[]) => listJobApplicationsMock(...args),
}));

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
  avgRating: '4.8',
  avgCategoryScores: null,
  totalJobsPosted: 3,
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra o total investido no mês e escalas preenchidas na semana nas estatísticas', async () => {
    listMyJobsMock.mockResolvedValue({ jobs: [{ ...JOB, status: 'filled', positionsFilled: 4 }] });

    renderPainel();

    await screen.findByText('Escalas abertas');
    expect(screen.getByText('R$ 520,00')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
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

  it('mostra mensagem de erro quando a listagem falha', async () => {
    listMyJobsMock.mockRejectedValue(new Error('falha'));

    renderPainel();

    expect(await screen.findByText('Não foi possível carregar suas escalas.')).toBeInTheDocument();
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
});
