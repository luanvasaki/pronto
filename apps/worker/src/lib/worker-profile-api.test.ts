import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();
vi.mock('./api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const { listSkillCategories, upsertWorkerProfile, uploadWorkerDocument } = await import(
  './worker-profile-api'
);

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

describe('upsertWorkerProfile', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama PUT /worker-profile com nome e categorias', async () => {
    apiFetchMock.mockResolvedValue({ fullName: 'Ana', categoryIds: ['1'] });

    await upsertWorkerProfile('Ana', ['1']);

    expect(apiFetchMock).toHaveBeenCalledWith('/worker-profile', {
      method: 'PUT',
      body: JSON.stringify({ fullName: 'Ana', categoryIds: ['1'] }),
    });
  });
});

describe('uploadWorkerDocument', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama POST /worker-profile/document com o arquivo em FormData', async () => {
    apiFetchMock.mockResolvedValue({ id: '1', status: 'pending' });
    const file = new File(['conteúdo'], 'rg.jpg', { type: 'image/jpeg' });

    await uploadWorkerDocument(file);

    const [path, options] = apiFetchMock.mock.calls[0];
    expect(path).toBe('/worker-profile/document');
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get('document')).toBe(file);
  });
});
