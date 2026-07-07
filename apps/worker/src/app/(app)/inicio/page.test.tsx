import { ApiError } from '@shift/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
const getWorkerProfileMock = vi.fn();
vi.mock('../../../lib/worker-profile-api', () => ({
  updateWorkerLocation: (...args: unknown[]) => updateWorkerLocationMock(...args),
  getWorkerProfile: (...args: unknown[]) => getWorkerProfileMock(...args),
}));

const PROFILE = {
  fullName: 'Ana Souza',
  categoryIds: ['cat-1'],
  photoUrl: null,
  homeAddressLabel: 'Campolim, Sorocaba',
  kycStatus: 'approved',
  avgRating: '4.8',
  totalShiftsCompleted: 10,
  totalNoShows: 0,
};

const JOB = {
  id: 'job-1',
  categoryId: 'cat-1',
  description: 'Vaga de garçom pra evento grande',
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
};

describe('InicioPage', () => {
  beforeEach(() => {
    listSkillCategoriesMock.mockReset().mockResolvedValue({ categories: [{ id: 'cat-1', name: 'Garçom' }] });
    listNearbyJobsMock.mockReset();
    applyToJobMock.mockReset();
    updateWorkerLocationMock.mockReset();
    getWorkerProfileMock.mockReset().mockResolvedValue(PROFILE);
    window.localStorage.clear();
    // Evita vazamento entre testes — cada um define seu próprio mock.
    Object.defineProperty(window.navigator, 'geolocation', { value: undefined, configurable: true });
  });

  it('mostra estado vazio quando não há vagas perto', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [] });

    render(<InicioPage />);

    expect(await screen.findByText('Nenhuma vaga disponível com esse filtro.')).toBeInTheDocument();
  });

  it('mostra saudação, nome e localização do trabalhador', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [] });

    render(<InicioPage />);

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('Campolim, Sorocaba')).toBeInTheDocument();
  });

  it('alterna a disponibilidade e mantém entre remontagens (localStorage)', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [] });
    const user = userEvent.setup();

    const { unmount } = render(<InicioPage />);
    await screen.findByText('Disponível para turnos');
    await user.click(screen.getByText('Disponível para turnos'));
    expect(await screen.findByText('Indisponível')).toBeInTheDocument();
    unmount();

    render(<InicioPage />);
    expect(await screen.findByText('Indisponível')).toBeInTheDocument();
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

    render(<InicioPage />);
    await screen.findByText('2 disponíveis');

    await user.click(screen.getByRole('button', { name: 'Hoje' }));
    expect(await screen.findByText('1 disponíveis')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Amanhã' }));
    expect(await screen.findByText('1 disponíveis')).toBeInTheDocument();
  });

  it('lista as vagas com categoria, distância e valor', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [JOB] });

    render(<InicioPage />);

    expect(await screen.findByText('Garçom')).toBeInTheDocument();
    expect(screen.getByText('2.3 km')).toBeInTheDocument();
    expect(screen.getByText('Vila Madalena, São Paulo')).toBeInTheDocument();
    expect(screen.getByText('R$ 130.00')).toBeInTheDocument();
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

    render(<InicioPage />);

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

    render(<InicioPage />);

    expect(
      await screen.findByText('Precisamos da sua localização pra mostrar vagas perto de você.'),
    ).toBeInTheDocument();
  });

  it('mostra a mensagem da API quando o erro não é sobre localização (não tenta geolocalização)', async () => {
    listNearbyJobsMock.mockRejectedValue(new ApiError(401, 'Sessão inválida ou expirada.'));

    render(<InicioPage />);

    expect(await screen.findByText('Sessão inválida ou expirada.')).toBeInTheDocument();
    expect(updateWorkerLocationMock).not.toHaveBeenCalled();
  });

  it('candidata-se e mostra confirmação quando a API responde bem', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [JOB] });
    applyToJobMock.mockResolvedValue({ id: 'app-1', status: 'pending' });
    const user = userEvent.setup();

    render(<InicioPage />);
    await screen.findByText('Garçom');
    await user.click(screen.getByRole('button', { name: /aceitar turno/i }));

    expect(await screen.findByRole('button', { name: /candidatura enviada/i })).toBeDisabled();
    expect(applyToJobMock).toHaveBeenCalledWith('job-1');
  });

  it('mostra a mensagem da API quando a candidatura falha', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [JOB] });
    applyToJobMock.mockRejectedValue(new ApiError(400, 'Você já se candidatou a essa vaga.'));
    const user = userEvent.setup();

    render(<InicioPage />);
    await screen.findByText('Garçom');
    await user.click(screen.getByRole('button', { name: /aceitar turno/i }));

    expect(await screen.findByText('Você já se candidatou a essa vaga.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /aceitar turno/i })).toBeEnabled());
  });
});
