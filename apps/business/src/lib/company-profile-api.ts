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
  personType: string;
  cnpj: string | null;
  cpf: string | null;
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

export interface CheckedOutNotification {
  shiftId: string;
  jobId: string;
  workerName: string;
  categoryName: string;
  checkOutAt: string;
}

export interface PendingRatingNotification {
  shiftId: string;
  jobId: string;
  workerName: string;
  categoryName: string;
  checkOutAt: string;
}

export interface CompanyNotifications {
  pendingApplicationsCount: number;
  pendingApplications: PendingApplicationNotification[];
  checkedInCount: number;
  checkedInNotifications: CheckedInNotification[];
  checkedOutCount: number;
  checkedOutNotifications: CheckedOutNotification[];
  pendingRatingsCount: number;
  pendingRatingsNotifications: PendingRatingNotification[];
}

export function getCompanyNotifications(): Promise<CompanyNotifications> {
  return apiFetch('/company-profile/notifications');
}

export interface CoverageWindow {
  windowHours: number;
  totalPositions: number;
  filledPositions: number;
  percentage: number | null;
}

export interface OpenPositionJob {
  jobId: string;
  categoryName: string;
  startsAt: string;
  positionsTotal: number;
  positionsFilled: number;
  openPositions: number;
}

export interface CompanyDashboard {
  coverage: CoverageWindow;
  openPositionJobs: OpenPositionJob[];
  notifications: CompanyNotifications;
}

export function getCompanyDashboard(): Promise<CompanyDashboard> {
  return apiFetch('/company-profile/dashboard');
}

export interface GrowthWeek {
  weekStart: string;
  count: number;
}

export interface CompanyGrowthMetrics {
  jobsPosted: GrowthWeek[];
  workersHired: GrowthWeek[];
  shiftsCompleted: GrowthWeek[];
}

export function getCompanyGrowthMetrics(): Promise<CompanyGrowthMetrics> {
  return apiFetch('/company-profile/growth-metrics');
}

export interface CompanyProfileResponse {
  id: string;
  legalName: string;
  tradeName: string;
  personType: string;
  cnpj: string | null;
  cpf: string | null;
  addressLabel: string | null;
  businessSegment: string | null;
  businessSegmentOther: string | null;
  verificationStatus: string;
}

export interface UpsertCompanyProfileInput {
  legalName: string;
  tradeName: string;
  /** Ausente = 'juridica' (padrão). */
  personType?: string;
  cnpj?: string;
  cpf?: string;
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

export interface UploadCompanyDocumentResponse {
  id: string;
}

export function uploadCompanyDocument(file: File): Promise<UploadCompanyDocumentResponse> {
  const formData = new FormData();
  formData.append('document', file);

  return apiFetch('/company-profile/document', {
    method: 'POST',
    body: formData,
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
