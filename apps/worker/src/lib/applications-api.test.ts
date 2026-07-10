import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();
vi.mock('@shift/shared', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const { listMyApplications, withdrawApplication } = await import('./applications-api');

describe('listMyApplications', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama GET /applications/mine', async () => {
    apiFetchMock.mockResolvedValue({ applications: [] });

    await listMyApplications();

    expect(apiFetchMock).toHaveBeenCalledWith('/applications/mine');
  });
});

describe('withdrawApplication', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama PATCH /applications/:id/withdraw', async () => {
    apiFetchMock.mockResolvedValue({ id: 'app-1', status: 'withdrawn' });

    await withdrawApplication('app-1');

    expect(apiFetchMock).toHaveBeenCalledWith('/applications/app-1/withdraw', { method: 'PATCH' });
  });
});
