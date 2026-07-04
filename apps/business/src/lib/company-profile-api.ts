import { apiFetch } from '@shift/shared';

export interface CompanyProfileResponse {
  id: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
  verificationStatus: string;
}

export function upsertCompanyProfile(
  legalName: string,
  tradeName: string,
  cnpj: string,
): Promise<CompanyProfileResponse> {
  return apiFetch('/company-profile', {
    method: 'PUT',
    body: JSON.stringify({ legalName, tradeName, cnpj }),
  });
}
