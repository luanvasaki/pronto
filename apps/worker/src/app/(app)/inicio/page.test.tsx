import { ApiError } from '@shift/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NOTIFICATIONS_POLL_INTERVAL_MS } from '../layout';
import { WorkerProfileProvider } from '../worker-profile-context';
import InicioPage from './page';

const listSkillCategoriesMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    listSkillCategories: (...args: unknown[]) => listSkillCategoriesMock(...args),
  };
});

const listNearbyJobsMock = vi.fn();
const applyToJobMock = vi.fn();
vi.mock('../../../lib/jobs-api', () => ({
  listNearbyJobs: (...args: unknown[]) => listNearbyJobsMock(...args),
  applyToJob: (...args: unknown[]) => applyToJobMock(...args),
}));

const updateWorkerLocationMock = vi.fn();
const updateSearchRadiusMock = vi.fn();
vi.mock('../../../lib/worker-profile-api', () => ({
  updateWorkerLocation: (...args: unknown[]) => updateWorkerLocationMock(...args),
  updateSearchRadius: (...args: unknown[]) => updateSearchRadiusMock(...args),
}));

const listMyApplicationsMock = vi.fn();
const markApplicationSeenMock = vi.fn();
const markRemovalSeenMock = vi.fn();
vi.mock('../../../lib/applications-api', () => ({
  listMyApplications: (...args: unknown[]) => listMyApplicationsMock(...args),
  markApplicationSeen: (...args: unknown[]) => markApplicationSeenMock(...args),
  markRemovalSeen: (...args: unknown[]) => markRemovalSeenMock(...args),
}));

const listMyShiftsMock = vi.fn();
vi.mock('../../../lib/shifts-api', () => ({
  listMyShifts: (...args: unknown[]) => listMyShiftsMock(...args),
}));

const PROFILE = {
  fullName: 'Ana Souza',
  bio: null,
  cpf: null,
  categoryIds: ['cat-1'],
  experienceByCategory: {},
  photoUrl: null,
  homeAddressLabel: 'Campolim, Sorocaba',
  homeLat: -23.4894,
  homeLng: -47.4619,
  searchRadiusKm: 10,
  homeAddressFull: 'Rua das Flores, 123, Centro, Sorocaba - SP',
  phone: '11912345678',
  birthDate: '2000-01-01',
  cnhCategory: null,
  kycStatus: 'approved',
  hasDocument: true,
  hasSelfie: true,
  hasCnhDocument: false,
  isMinor: false,
  guardianFullName: null,
  guardianCpf: null,
  guardianPhone: null,
  guardianAuthorizedAt: null,
  hasGuardianDocument: false,
  documentRejectionReason: null,
  selfieRejectionReason: null,
  cnhRejectionReason: null,
  guardianDocumentRejectionReason: null,
  needsTermsAcceptance: false,
  hasAcceptedLoginTerms: true,
  avgRating: '4.8',
  avgCategoryScores: null,
  totalShiftsCompleted: 10,
  totalHoursWorked: 34,
  companiesServed: 3,
  rehireRate: 33,
  attendanceRate: 95,
  cancellations: 0,
};

function renderPage() {
  return render(
    <WorkerProfileProvider initialProfile={PROFILE}>
      <InicioPage />
    </WorkerProfileProvider>,
  );
}

const JOB = {
  id: 'job-1',
  categoryId: 'cat-1',
  description: 'Vaga de garçom pra evento grande',
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
  status: 'open',
  distanceKm: 2.3,
  companyName: 'Buffet Aurora',
  companyAvgRating: '4.8',
  matchesSkills: true,
  experienceMismatch: false,
  cnhCategory: null,
  cnhRequired: false,
  cnhMismatch: false,
};

describe('InicioPage', () => {
  beforeEach(() => {
    listSkillCategoriesMock.mockReset().mockResolvedValue({ categories: [{ id: 'cat-1', name: 'Garçom' }] });
    listNearbyJobsMock.mockReset();
    applyToJobMock.mockReset();
    updateWorkerLocationMock.mockReset();
    updateSearchRadiusMock.mockReset();
    listMyApplicationsMock.mockReset().mockResolvedValue({ applications: [] });
    markApplicationSeenMock.mockReset();
    markRemovalSeenMock.mockReset();
    listMyShiftsMock.mockReset().mockResolvedValue({ shifts: [] });
    window.localStorage.clear();
    // Evita vazamento entre testes — cada um define seu próprio mock.
    Object.defineProperty(window.navigator, 'geolocation', { value: undefined, configurable: true });
  });

  it('mostra estado vazio quando não há vagas perto', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [] });

    renderPage();

    expect(await screen.findByText('Nenhuma vaga disponível com esse filtro.')).toBeInTheDocument();
  });

  it('mostra a localização usada pra buscar vagas', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [] });

    renderPage();

    expect(await screen.findByText('Campolim, Sorocaba')).toBeInTheDocument();
  });

  it('avisa que o documento está em análise e ainda não pode se candidatar', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [] });

    render(
      <WorkerProfileProvider initialProfile={{ ...PROFILE, kycStatus: 'pending' }}>
        <InicioPage />
      </WorkerProfileProvider>,
    );

    expect(await screen.findByText(/documento em análise/i)).toBeInTheDocument();
    expect(screen.getByText(/ainda não pode se candidatar/i)).toBeInTheDocument();
  });

  it('avisa que o documento foi recusado, com aviso diferente do de análise', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [] });

    render(
      <WorkerProfileProvider initialProfile={{ ...PROFILE, kycStatus: 'rejected' }}>
        <InicioPage />
      </WorkerProfileProvider>,
    );

    expect(await screen.findByText(/documento recusado/i)).toBeInTheDocument();
  });

  it('não mostra aviso de documento quando já está aprovado', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [] });

    renderPage();

    await screen.findByText('Campolim, Sorocaba');
    expect(screen.queryByText(/documento em análise/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/documento recusado/i)).not.toBeInTheDocument();
  });

  it('filtra as vagas por hoje/amanhã', async () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const jobToday = { ...JOB, id: 'job-today', startsAt: today.toISOString(), endsAt: today.toISOString() };
    const jobTomorrow = {
      ...JOB,
      id: 'job-tomorrow',
      startsAt: tomorrow.toISOString(),
      endsAt: tomorrow.toISOString(),
    };
    listNearbyJobsMock.mockResolvedValue({ jobs: [jobToday, jobTomorrow] });
    const user = userEvent.setup();

    renderPage();
    await screen.findByText('2 disponíveis');

    await user.click(screen.getByRole('button', { name: 'Hoje' }));
    expect(await screen.findByText('1 disponíveis')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Amanhã' }));
    expect(await screen.findByText('1 disponíveis')).toBeInTheDocument();
  });

  it('lista as vagas com categoria, distância e valor', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [JOB] });

    renderPage();

    expect(await screen.findByText('Garçom')).toBeInTheDocument();
    expect(screen.getByText('2.3 km')).toBeInTheDocument();
    expect(screen.getByText('Vila Madalena, São Paulo')).toBeInTheDocument();
    expect(screen.getByText('R$ 130.00')).toBeInTheDocument();
  });

  it('mostra experiência, vestimenta e ferramentas exigidas quando presentes', async () => {
    listNearbyJobsMock.mockResolvedValue({
      jobs: [{ ...JOB, requiresExperience: true, dressCode: 'Social completo', toolsRequired: 'Câmera própria' }],
    });

    renderPage();

    expect(await screen.findByText('Experiência necessária')).toBeInTheDocument();
    expect(screen.getByText('Social completo')).toBeInTheDocument();
    expect(screen.getByText('Câmera própria')).toBeInTheDocument();
  });

  it('avisa quando a vaga não bate com as especialidades do trabalhador', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [{ ...JOB, matchesSkills: false }] });

    renderPage();

    expect(
      await screen.findByText('Você não tem essa especialidade no seu perfil — pode se candidatar mesmo assim.'),
    ).toBeInTheDocument();
  });

  it('bloqueia candidatura até confirmar o checkbox quando falta experiência exigida', async () => {
    listNearbyJobsMock.mockResolvedValue({
      jobs: [{ ...JOB, requiresExperience: true, experienceMismatch: true }],
    });
    const user = userEvent.setup();

    renderPage();
    await screen.findByText('Garçom');

    const applyButton = screen.getByRole('button', { name: /aceitar escala/i });
    expect(applyButton).toBeDisabled();

    await user.click(screen.getByRole('checkbox'));
    expect(applyButton).toBeEnabled();

    await user.click(applyButton);
    expect(applyToJobMock).toHaveBeenCalledWith('job-1');
  });

  it('não bloqueia a candidatura quando o trabalhador já declarou experiência', async () => {
    listNearbyJobsMock.mockResolvedValue({
      jobs: [{ ...JOB, requiresExperience: true, experienceMismatch: false }],
    });

    renderPage();
    await screen.findByText('Garçom');

    expect(screen.getByRole('button', { name: /aceitar escala/i })).toBeEnabled();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('não mostra badges de requisito quando a vaga não exige nada', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [JOB] });

    renderPage();

    await screen.findByText('Garçom');
    expect(screen.queryByText('Experiência necessária')).not.toBeInTheDocument();
  });

  it('bloqueia a candidatura sem opção de confirmar quando falta CNH obrigatória', async () => {
    listNearbyJobsMock.mockResolvedValue({
      jobs: [{ ...JOB, cnhCategory: 'B', cnhRequired: true, cnhMismatch: true }],
    });

    renderPage();
    await screen.findByText('Garçom');

    expect(screen.getByText('CNH B obrigatória')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aceitar escala/i })).toBeDisabled();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('não bloqueia a candidatura quando a CNH é só preferência', async () => {
    listNearbyJobsMock.mockResolvedValue({
      jobs: [{ ...JOB, cnhCategory: 'B', cnhRequired: false, cnhMismatch: true }],
    });

    renderPage();
    await screen.findByText('Garçom');

    expect(screen.getByText('CNH B (preferência)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aceitar escala/i })).toBeEnabled();
  });

  it('não bloqueia a candidatura quando o trabalhador já tem a CNH exigida', async () => {
    listNearbyJobsMock.mockResolvedValue({
      jobs: [{ ...JOB, cnhCategory: 'B', cnhRequired: true, cnhMismatch: false }],
    });

    renderPage();
    await screen.findByText('Garçom');

    expect(screen.getByRole('button', { name: /aceitar escala/i })).toBeEnabled();
  });

  it('deixa atualizar a localização manualmente pelo botão da tela', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [JOB] });
    updateWorkerLocationMock.mockResolvedValue({
      homeLat: -23.55,
      homeLng: -46.63,
      homeAddressLabel: 'Pinheiros, São Paulo',
    });
    Object.defineProperty(window.navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((success) => success({ coords: { latitude: -23.55, longitude: -46.63 } })),
      },
      configurable: true,
    });
    const user = userEvent.setup();

    renderPage();
    await screen.findByText('Garçom');
    await user.click(screen.getByRole('button', { name: 'Atualizar localização' }));

    await waitFor(() => expect(updateWorkerLocationMock).toHaveBeenCalledWith(-23.55, -46.63));
    expect(await screen.findByText('Pinheiros, São Paulo')).toBeInTheDocument();
  });

  it('deixa trocar o raio de busca e recarrega as vagas', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [JOB] });
    updateSearchRadiusMock.mockResolvedValue({ searchRadiusKm: 30 });
    const user = userEvent.setup();

    renderPage();
    await screen.findByText('Garçom');
    await user.selectOptions(screen.getByLabelText('Raio de busca'), '30');

    await waitFor(() => expect(updateSearchRadiusMock).toHaveBeenCalledWith(30));
    await waitFor(() => expect(listNearbyJobsMock).toHaveBeenCalledTimes(2));
  });

  it('pede localização e tenta de novo quando o backend diz que ela falta', async () => {
    listNearbyJobsMock
      .mockRejectedValueOnce(new ApiError(400, 'Defina sua localização antes de ver vagas.'))
      .mockResolvedValueOnce({ jobs: [JOB] });
    updateWorkerLocationMock.mockResolvedValue({ homeLat: -23.55, homeLng: -46.63 });
    Object.defineProperty(window.navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((success) => success({ coords: { latitude: -23.55, longitude: -46.63 } })),
      },
      configurable: true,
    });

    renderPage();

    expect(await screen.findByText('Garçom')).toBeInTheDocument();
    expect(updateWorkerLocationMock).toHaveBeenCalledWith(-23.55, -46.63);
    expect(listNearbyJobsMock).toHaveBeenCalledTimes(2);
  });

  it('mostra mensagem de erro quando o navegador nega a localização', async () => {
    listNearbyJobsMock.mockRejectedValue(new ApiError(400, 'Defina sua localização antes de ver vagas.'));
    Object.defineProperty(window.navigator, 'geolocation', {
      value: { getCurrentPosition: vi.fn((_success, failure) => failure()) },
      configurable: true,
    });

    renderPage();

    expect(
      await screen.findByText('Precisamos da sua localização pra mostrar vagas perto de você.'),
    ).toBeInTheDocument();
  });

  it('mostra a mensagem da API quando o erro não é sobre localização (não tenta geolocalização)', async () => {
    listNearbyJobsMock.mockRejectedValue(new ApiError(401, 'Sessão inválida ou expirada.'));

    renderPage();

    expect(await screen.findByText('Sessão inválida ou expirada.')).toBeInTheDocument();
    expect(updateWorkerLocationMock).not.toHaveBeenCalled();
  });

  it('candidata-se e mostra confirmação quando a API responde bem', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [JOB] });
    applyToJobMock.mockResolvedValue({ id: 'app-1', status: 'pending' });
    const user = userEvent.setup();

    renderPage();
    await screen.findByText('Garçom');
    await user.click(screen.getByRole('button', { name: /aceitar escala/i }));

    expect(await screen.findByRole('button', { name: /candidatura enviada/i })).toBeDisabled();
    expect(applyToJobMock).toHaveBeenCalledWith('job-1');
  });

  it('mostra a mensagem da API quando a candidatura falha', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [JOB] });
    applyToJobMock.mockRejectedValue(new ApiError(400, 'Você já se candidatou a essa vaga.'));
    const user = userEvent.setup();

    renderPage();
    await screen.findByText('Garçom');
    await user.click(screen.getByRole('button', { name: /aceitar escala/i }));

    expect(await screen.findByText('Você já se candidatou a essa vaga.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /aceitar escala/i })).toBeEnabled());
  });

  it('mostra alerta quando o trabalhador foi aprovado e ainda não viu', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [] });
    listMyApplicationsMock.mockResolvedValue({
      applications: [
        {
          id: 'app-1',
          status: 'approved',
          workerSeenAt: null,
          createdAt: '2026-07-01T12:00:00.000Z',
          job: JOB,
          companyName: 'Buffet Aurora',
        },
      ],
    });

    renderPage();

    expect(await screen.findByText(/Você foi chamado\(a\) pra trabalhar em Buffet Aurora/)).toBeInTheDocument();
  });

  it('não mostra alerta pra candidatura aprovada que já foi vista', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [] });
    listMyApplicationsMock.mockResolvedValue({
      applications: [
        {
          id: 'app-1',
          status: 'approved',
          workerSeenAt: '2026-07-01T12:00:00.000Z',
          createdAt: '2026-07-01T12:00:00.000Z',
          job: JOB,
          companyName: 'Buffet Aurora',
        },
      ],
    });

    renderPage();

    await screen.findByText('Nenhuma vaga disponível com esse filtro.');
    expect(screen.queryByText(/Você foi chamado\(a\)/)).not.toBeInTheDocument();
  });

  it('dispensa o alerta e marca a candidatura como vista', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [] });
    listMyApplicationsMock.mockResolvedValue({
      applications: [
        {
          id: 'app-1',
          status: 'approved',
          workerSeenAt: null,
          createdAt: '2026-07-01T12:00:00.000Z',
          job: JOB,
          companyName: 'Buffet Aurora',
        },
      ],
    });
    markApplicationSeenMock.mockResolvedValue({
      id: 'app-1',
      jobId: 'job-1',
      workerId: 'worker-1',
      status: 'approved',
      workerSeenAt: '2026-07-02T12:00:00.000Z',
      createdAt: '2026-07-01T12:00:00.000Z',
    });
    const user = userEvent.setup();

    renderPage();
    await screen.findByText(/Você foi chamado\(a\)/);
    await user.click(screen.getByRole('button', { name: /ok, entendi/i }));

    await waitFor(() => expect(screen.queryByText(/Você foi chamado\(a\)/)).not.toBeInTheDocument());
    expect(markApplicationSeenMock).toHaveBeenCalledWith('app-1');
  });

  it('mostra alerta quando o trabalhador foi removido de um turno aprovado e ainda não viu', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [] });
    listMyApplicationsMock.mockResolvedValue({
      applications: [
        {
          id: 'app-1',
          status: 'rejected',
          workerSeenAt: '2026-07-01T12:00:00.000Z',
          removedAt: '2026-07-02T12:00:00.000Z',
          workerSeenRemovalAt: null,
          createdAt: '2026-07-01T12:00:00.000Z',
          job: JOB,
          companyName: 'Buffet Aurora',
        },
      ],
    });

    renderPage();

    expect(await screen.findByText(/Buffet Aurora removeu você da escala de Garçom/)).toBeInTheDocument();
  });

  it('não mostra alerta de remoção já visto', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [] });
    listMyApplicationsMock.mockResolvedValue({
      applications: [
        {
          id: 'app-1',
          status: 'rejected',
          workerSeenAt: '2026-07-01T12:00:00.000Z',
          removedAt: '2026-07-02T12:00:00.000Z',
          workerSeenRemovalAt: '2026-07-02T13:00:00.000Z',
          createdAt: '2026-07-01T12:00:00.000Z',
          job: JOB,
          companyName: 'Buffet Aurora',
        },
      ],
    });

    renderPage();

    await screen.findByText('Nenhuma vaga disponível com esse filtro.');
    expect(screen.queryByText(/removeu você da escala/)).not.toBeInTheDocument();
  });

  it('dispensa o alerta de remoção e marca como vista', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [] });
    listMyApplicationsMock.mockResolvedValue({
      applications: [
        {
          id: 'app-1',
          status: 'rejected',
          workerSeenAt: '2026-07-01T12:00:00.000Z',
          removedAt: '2026-07-02T12:00:00.000Z',
          workerSeenRemovalAt: null,
          createdAt: '2026-07-01T12:00:00.000Z',
          job: JOB,
          companyName: 'Buffet Aurora',
        },
      ],
    });
    markRemovalSeenMock.mockResolvedValue({
      id: 'app-1',
      jobId: 'job-1',
      workerId: 'worker-1',
      status: 'rejected',
      workerSeenAt: '2026-07-01T12:00:00.000Z',
      removedAt: '2026-07-02T12:00:00.000Z',
      workerSeenRemovalAt: '2026-07-02T14:00:00.000Z',
      createdAt: '2026-07-01T12:00:00.000Z',
    });
    const user = userEvent.setup();

    renderPage();
    await screen.findByText(/removeu você da escala/);
    await user.click(screen.getByRole('button', { name: /ok, entendi/i }));

    await waitFor(() => expect(screen.queryByText(/removeu você da escala/)).not.toBeInTheDocument());
    expect(markRemovalSeenMock).toHaveBeenCalledWith('app-1');
  });

  it('avisa de escala concluída esperando avaliação, com link pra Agenda', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [] });
    listMyShiftsMock.mockResolvedValue({
      shifts: [
        { id: 'shift-1', status: 'completed', ratings: { worker: null, company: null } },
        { id: 'shift-2', status: 'completed', ratings: { worker: { id: 'r1' }, company: null } },
        { id: 'shift-3', status: 'scheduled', ratings: { worker: null, company: null } },
      ],
    });

    renderPage();

    expect(await screen.findByText('1 escala concluída esperando sua avaliação')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /1 escala concluída/i })).toHaveAttribute('href', '/agenda');
  });

  it('não avisa de avaliação pendente quando não há escala concluída sem avaliação', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [] });
    listMyShiftsMock.mockResolvedValue({
      shifts: [{ id: 'shift-1', status: 'completed', ratings: { worker: { id: 'r1' }, company: null } }],
    });

    renderPage();

    await screen.findByText('Nenhuma vaga disponível com esse filtro.');
    expect(screen.queryByText(/esperando sua avaliação/)).not.toBeInTheDocument();
  });

  it('atualiza os avisos periodicamente (mesmo intervalo do sino), sem depender do usuário sair e voltar', async () => {
    vi.useFakeTimers();
    try {
      listNearbyJobsMock.mockResolvedValue({ jobs: [] });
      listMyApplicationsMock.mockResolvedValue({ applications: [] });
      listMyShiftsMock.mockResolvedValue({ shifts: [] });

      renderPage();
      await vi.waitFor(() => expect(listMyApplicationsMock).toHaveBeenCalledTimes(1));

      listMyApplicationsMock.mockResolvedValue({
        applications: [
          {
            id: 'app-1',
            status: 'approved',
            workerSeenAt: null,
            createdAt: '2026-07-01T12:00:00.000Z',
            job: JOB,
            companyName: 'Buffet Aurora',
          },
        ],
      });

      await vi.advanceTimersByTimeAsync(NOTIFICATIONS_POLL_INTERVAL_MS);

      expect(listMyApplicationsMock).toHaveBeenCalledTimes(2);
      expect(listMyShiftsMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText(/Você foi chamado\(a\) pra trabalhar em Buffet Aurora/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
