import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();
vi.mock('@shift/shared', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const { listMyApplications } = await import('./applications-api');

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
