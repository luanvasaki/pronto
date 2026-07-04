import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();
vi.mock('@shift/shared', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const { getCompanyProfile, upsertCompanyProfile } = await import('./company-profile-api');

describe('getCompanyProfile', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama GET /company-profile/me', async () => {
    apiFetchMock.mockResolvedValue({ id: '1', tradeName: 'Bar', verificationStatus: 'pending' });

    await getCompanyProfile();

    expect(apiFetchMock).toHaveBeenCalledWith('/company-profile/me');
  });
});

describe('upsertCompanyProfile', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama PUT /company-profile com os dados da empresa', async () => {
    apiFetchMock.mockResolvedValue({ id: '1', legalName: 'Bar Ltda', tradeName: 'Bar', cnpj: '11222333000181' });

    await upsertCompanyProfile('Bar Ltda', 'Bar', '11222333000181');

    expect(apiFetchMock).toHaveBeenCalledWith('/company-profile', {
      method: 'PUT',
      body: JSON.stringify({ legalName: 'Bar Ltda', tradeName: 'Bar', cnpj: '11222333000181' }),
    });
  });
});
