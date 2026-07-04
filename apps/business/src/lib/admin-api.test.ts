import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();
vi.mock('@shift/shared', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const { listPendingVerifications, reviewDocument, reviewCompany, fetchDocumentImageUrl } = await import(
  './admin-api'
);

describe('listPendingVerifications', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama GET /admin/verifications', async () => {
    apiFetchMock.mockResolvedValue({ documents: [], companies: [] });

    await listPendingVerifications();

    expect(apiFetchMock).toHaveBeenCalledWith('/admin/verifications');
  });
});

describe('reviewDocument', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama PATCH /admin/documents/:id com o status', async () => {
    apiFetchMock.mockResolvedValue({ id: 'doc-1', status: 'approved' });

    await reviewDocument('doc-1', 'approved');

    expect(apiFetchMock).toHaveBeenCalledWith('/admin/documents/doc-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved' }),
    });
  });
});

describe('reviewCompany', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama PATCH /admin/companies/:id/verification com o status', async () => {
    apiFetchMock.mockResolvedValue({ id: 'company-1', verificationStatus: 'rejected' });

    await reviewCompany('company-1', 'rejected');

    expect(apiFetchMock).toHaveBeenCalledWith('/admin/companies/company-1/verification', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'rejected' }),
    });
  });
});

describe('fetchDocumentImageUrl', () => {
  const originalFetch = global.fetch;
  const originalCreateObjectURL = URL.createObjectURL;

  beforeEach(() => {
    global.fetch = vi.fn();
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectURL;
  });

  it('busca o arquivo com credenciais e retorna uma object URL', async () => {
    const blob = new Blob(['conteúdo']);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(blob),
    });

    const url = await fetchDocumentImageUrl('doc-1');

    expect(url).toBe('blob:mock-url');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/documents/doc-1/file'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('lança erro quando a resposta não é ok', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });

    await expect(fetchDocumentImageUrl('doc-1')).rejects.toThrow('Não foi possível carregar o documento.');
  });
});
