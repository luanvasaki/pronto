import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();
vi.mock('@shift/shared', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const { listMyJobs, createJob } = await import('./jobs-api');

describe('listMyJobs', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama GET /jobs/mine', async () => {
    apiFetchMock.mockResolvedValue({ jobs: [] });

    await listMyJobs();

    expect(apiFetchMock).toHaveBeenCalledWith('/jobs/mine');
  });
});

describe('createJob', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama POST /jobs com os dados da vaga', async () => {
    const input = {
      categoryId: 'cat-1',
      description: 'Descrição da vaga',
      addressLabel: 'Vila Madalena, São Paulo',
      locationLat: -23.55,
      locationLng: -46.63,
      positionsTotal: 2,
      payAmount: '120.00',
      startsAt: '2026-08-01T18:00:00.000Z',
      endsAt: '2026-08-01T23:00:00.000Z',
    };
    apiFetchMock.mockResolvedValue({ id: '1', ...input, positionsFilled: 0, status: 'open' });

    await createJob(input);

    expect(apiFetchMock).toHaveBeenCalledWith('/jobs', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  });
});
