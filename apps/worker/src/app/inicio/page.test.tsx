import { ApiError } from '@shift/shared';
import { render, screen } from '@testing-library/react';
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
vi.mock('../../lib/jobs-api', () => ({
  listNearbyJobs: (...args: unknown[]) => listNearbyJobsMock(...args),
}));

const updateWorkerLocationMock = vi.fn();
vi.mock('../../lib/worker-profile-api', () => ({
  updateWorkerLocation: (...args: unknown[]) => updateWorkerLocationMock(...args),
}));

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
};

describe('InicioPage', () => {
  beforeEach(() => {
    listSkillCategoriesMock.mockReset().mockResolvedValue({ categories: [{ id: 'cat-1', name: 'Garçom' }] });
    listNearbyJobsMock.mockReset();
    updateWorkerLocationMock.mockReset();
    // Evita vazamento entre testes — cada um define seu próprio mock.
    Object.defineProperty(window.navigator, 'geolocation', { value: undefined, configurable: true });
  });

  it('mostra estado vazio quando não há vagas perto', async () => {
    listNearbyJobsMock.mockResolvedValue({ jobs: [] });

    render(<InicioPage />);

    expect(
      await screen.findByText('Nenhuma vaga disponível perto de você no momento.'),
    ).toBeInTheDocument();
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
});
