import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();
vi.mock('@shift/shared', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const { getWorkerProfile, upsertWorkerProfile, uploadWorkerDocument, updateWorkerLocation } = await import(
  './worker-profile-api'
);

describe('getWorkerProfile', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama GET /worker-profile/me', async () => {
    apiFetchMock.mockResolvedValue({ fullName: 'Ana', categoryIds: ['1'], kycStatus: 'pending' });

    await getWorkerProfile();

    expect(apiFetchMock).toHaveBeenCalledWith('/worker-profile/me');
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

describe('updateWorkerLocation', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama PATCH /worker-profile/location com lat e lng', async () => {
    apiFetchMock.mockResolvedValue({ homeLat: -23.55, homeLng: -46.63 });

    await updateWorkerLocation(-23.55, -46.63);

    expect(apiFetchMock).toHaveBeenCalledWith('/worker-profile/location', {
      method: 'PATCH',
      body: JSON.stringify({ lat: -23.55, lng: -46.63 }),
    });
  });
});
