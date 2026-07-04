import { apiFetch } from '@shift/shared';

export interface CompanyProfileDetails {
  id: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
  verificationStatus: string;
  avgRating: string | null;
  totalJobsPosted: number;
}

export function getCompanyProfile(): Promise<CompanyProfileDetails> {
  return apiFetch('/company-profile/me');
}

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
