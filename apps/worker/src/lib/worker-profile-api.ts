import { apiFetch } from '@shift/shared';

export interface WorkerProfileDetails {
  fullName: string;
  bio: string | null;
  cpf: string | null;
  categoryIds: string[];
  experienceByCategory: Record<string, boolean>;
  photoUrl: string | null;
  homeAddressLabel: string | null;
  kycStatus: string;
  hasDocument: boolean;
  avgRating: string | null;
  totalShiftsCompleted: number;
  totalHoursWorked: number;
}

export function getWorkerProfile(): Promise<WorkerProfileDetails> {
  return apiFetch('/worker-profile/me');
}

export interface UpsertWorkerProfileInput {
  fullName: string;
  categoryIds: string[];
  photoUrl?: string;
  bio?: string;
  cpf?: string;
  experienceByCategory?: Record<string, boolean>;
}

export interface UpsertWorkerProfileResponse {
  fullName: string;
  categoryIds: string[];
  photoUrl: string | null;
  bio: string | null;
  cpf: string | null;
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
}

export function uploadWorkerDocument(file: File): Promise<UploadDocumentResponse> {
  const formData = new FormData();
  formData.append('document', file);

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
