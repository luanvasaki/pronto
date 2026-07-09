import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();
vi.mock('./api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const { listSkillCategories, createSkillCategory } = await import('./skill-categories-api');

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

describe('createSkillCategory', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama POST /skill-categories com o nome', async () => {
    apiFetchMock.mockResolvedValue({ id: 'cat-1', name: 'Manobrista' });

    await createSkillCategory('Manobrista');

    expect(apiFetchMock).toHaveBeenCalledWith('/skill-categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'Manobrista' }),
    });
  });
});
