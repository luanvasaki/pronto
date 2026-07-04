import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();
vi.mock('@shift/shared', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const { listNearbyJobs } = await import('./jobs-api');

describe('listNearbyJobs', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama GET /jobs/nearby', async () => {
    apiFetchMock.mockResolvedValue({ jobs: [] });

    await listNearbyJobs();

    expect(apiFetchMock).toHaveBeenCalledWith('/jobs/nearby');
  });
});
