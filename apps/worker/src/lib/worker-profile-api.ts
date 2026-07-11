import { apiFetch } from '@shift/shared';

export interface WorkerProfileDetails {
  fullName: string;
  bio: string | null;
  cpf: string | null;
  categoryIds: string[];
  experienceByCategory: Record<string, boolean>;
  photoUrl: string | null;
  homeAddressLabel: string | null;
  homeAddressFull: string | null;
  cnhCategory: string | null;
  kycStatus: string;
  hasDocument: boolean;
  hasSelfie: boolean;
  avgRating: string | null;
  avgCategoryScores: Record<string, string> | null;
  totalShiftsCompleted: number;
  totalHoursWorked: number;
  companiesServed: number;
  rehireRate: number | null;
  attendanceRate: number | null;
  cancellations: number;
}

export function getWorkerProfile(): Promise<WorkerProfileDetails> {
  return apiFetch('/worker-profile/me');
}

export interface WorkerRatingHistoryEntry {
  id: string;
  companyName: string;
  categoryId: string;
  score: number;
  categoryScores: Record<string, number> | null;
  comment: string | null;
  shiftDate: string;
  createdAt: string;
}

export function listWorkerRatings(): Promise<{ ratings: WorkerRatingHistoryEntry[] }> {
  return apiFetch('/worker-profile/ratings');
}

export interface UpsertWorkerProfileInput {
  fullName: string;
  categoryIds: string[];
  photoUrl?: string;
  bio?: string;
  cpf?: string;
  homeAddressFull?: string;
  cnhCategory?: string;
  experienceByCategory?: Record<string, boolean>;
}

export interface UpsertWorkerProfileResponse {
  fullName: string;
  categoryIds: string[];
  photoUrl: string | null;
  bio: string | null;
  cpf: string | null;
  homeAddressFull: string | null;
  cnhCategory: string | null;
  experienceByCategory: Record<string, boolean>;
}

export function upsertWorkerProfile(input: UpsertWorkerProfileInput): Promise<UpsertWorkerProfileResponse> {
  return apiFetch('/worker-profile', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export interface UploadDocumentResponse {
  id: string;
  status: string;
  type: string;
}

export function uploadWorkerDocument(file: File): Promise<UploadDocumentResponse> {
  const formData = new FormData();
  formData.append('document', file);
  formData.append('type', 'identity');

  return apiFetch('/worker-profile/document', {
    method: 'POST',
    body: formData,
  });
}

export function uploadWorkerSelfie(file: File): Promise<UploadDocumentResponse> {
  const formData = new FormData();
  formData.append('document', file);
  formData.append('type', 'selfie');

  return apiFetch('/worker-profile/document', {
    method: 'POST',
    body: formData,
  });
}

export interface UploadWorkerPhotoResponse {
  photoUrl: string;
}

export function uploadWorkerPhoto(file: File): Promise<UploadWorkerPhotoResponse> {
  const formData = new FormData();
  formData.append('photo', file);

  return apiFetch('/worker-profile/photo', {
    method: 'POST',
    body: formData,
  });
}

export interface UpdateWorkerLocationResponse {
  homeLat: number;
  homeLng: number;
  homeAddressLabel: string | null;
}

export function updateWorkerLocation(lat: number, lng: number): Promise<UpdateWorkerLocationResponse> {
  return apiFetch('/worker-profile/location', {
    method: 'PATCH',
    body: JSON.stringify({ lat, lng }),
  });
}
