import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();
vi.mock('@shift/shared', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const { listJobApplications, updateApplicationStatus } = await import('./applications-api');

describe('listJobApplications', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama GET /jobs/:jobId/applications', async () => {
    apiFetchMock.mockResolvedValue({ applications: [] });

    await listJobApplications('job-1');

    expect(apiFetchMock).toHaveBeenCalledWith('/jobs/job-1/applications');
  });
});

describe('updateApplicationStatus', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama PATCH /applications/:id com o status', async () => {
    apiFetchMock.mockResolvedValue({ id: 'app-1', status: 'approved' });

    await updateApplicationStatus('app-1', 'approved');

    expect(apiFetchMock).toHaveBeenCalledWith('/applications/app-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved' }),
    });
  });
});
