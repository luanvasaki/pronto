import { apiFetch } from '@shift/shared';

export const BUSINESS_SEGMENTS = [
  { value: 'bar', label: 'Bar' },
  { value: 'restaurante', label: 'Restaurante' },
  { value: 'buffet', label: 'Buffet' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'eventos', label: 'Casa de eventos' },
  { value: 'casa_noturna', label: 'Casa noturna' },
  { value: 'outro', label: 'Outro' },
] as const;

export interface CompanyProfileDetails {
  id: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
  logoUrl: string | null;
  addressLabel: string | null;
  businessSegment: string | null;
  businessSegmentOther: string | null;
  verificationStatus: string;
  avgRating: string | null;
  avgCategoryScores: Record<string, string> | null;
  totalJobsPosted: number;
  jobsPosted: number;
  shiftsCompleted: number;
  rehireRate: number | null;
  jobsOpenedThisMonth: number;
  workersHiredThisMonth: number;
  topHiredWorkerName: string | null;
  topHiredWorkerCount: number;
}

export function getCompanyProfile(): Promise<CompanyProfileDetails> {
  return apiFetch('/company-profile/me');
}

export interface CompanyRatingHistoryEntry {
  id: string;
  workerName: string;
  categoryId: string;
  score: number;
  categoryScores: Record<string, number> | null;
  comment: string | null;
  shiftDate: string;
  createdAt: string;
}

export function listCompanyRatings(): Promise<{ ratings: CompanyRatingHistoryEntry[] }> {
  return apiFetch('/company-profile/ratings');
}

export interface PendingApplicationNotification {
  applicationId: string;
  jobId: string;
  workerName: string;
  categoryName: string;
}

export interface CheckedInNotification {
  shiftId: string;
  jobId: string;
  workerName: string;
  categoryName: string;
  checkInAt: string;
}

export interface CompanyNotifications {
  pendingApplicationsCount: number;
  pendingApplications: PendingApplicationNotification[];
  checkedInCount: number;
  checkedInNotifications: CheckedInNotification[];
}

export function getCompanyNotifications(): Promise<CompanyNotifications> {
  return apiFetch('/company-profile/notifications');
}

export function markShiftCheckInSeen(shiftId: string): Promise<{ id: string; status: string }> {
  return apiFetch(`/shifts/${shiftId}/check-in/seen`, { method: 'PATCH' });
}

export interface CompanyProfileResponse {
  id: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
  addressLabel: string | null;
  businessSegment: string | null;
  businessSegmentOther: string | null;
  verificationStatus: string;
}

export interface UpsertCompanyProfileInput {
  legalName: string;
  tradeName: string;
  cnpj: string;
  addressLabel?: string;
  businessSegment?: string;
  businessSegmentOther?: string;
}

export function upsertCompanyProfile(input: UpsertCompanyProfileInput): Promise<CompanyProfileResponse> {
  return apiFetch('/company-profile', {
    method: 'PUT',
    body: JSON.stringify(input),
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

export function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  return apiFetch('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
