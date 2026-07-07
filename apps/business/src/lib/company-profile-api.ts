import { apiFetch } from '@shift/shared';

export interface CompanyProfileDetails {
  id: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
  logoUrl: string | null;
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

export interface UploadCompanyLogoResponse {
  logoUrl: string;
}

export function uploadCompanyLogo(file: File): Promise<UploadCompanyLogoResponse> {
  const formData = new FormData();
  formData.append('logo', file);

  return apiFetch('/company-profile/logo', {
    method: 'POST',
    body: formData,
  });
}
