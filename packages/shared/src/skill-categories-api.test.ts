import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();
vi.mock('./api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const { listSkillCategories } = await import('./skill-categories-api');

describe('listSkillCategories', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama GET /skill-categories', async () => {
    apiFetchMock.mockResolvedValue({ categories: [] });

    await listSkillCategories();

    expect(apiFetchMock).toHaveBeenCalledWith('/skill-categories');
  });
});
