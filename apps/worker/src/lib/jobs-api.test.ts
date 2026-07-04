import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();
vi.mock('@shift/shared', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const { listNearbyJobs, applyToJob } = await import('./jobs-api');

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

describe('applyToJob', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama POST /jobs/:jobId/applications', async () => {
    apiFetchMock.mockResolvedValue({ id: '1', status: 'pending' });

    await applyToJob('job-1');

    expect(apiFetchMock).toHaveBeenCalledWith('/jobs/job-1/applications', { method: 'POST' });
  });
});
