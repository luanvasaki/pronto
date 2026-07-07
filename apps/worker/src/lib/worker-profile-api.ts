import { apiFetch } from '@shift/shared';

export interface WorkerProfileDetails {
  fullName: string;
  categoryIds: string[];
  photoUrl: string | null;
  homeAddressLabel: string | null;
  kycStatus: string;
  avgRating: string | null;
  totalShiftsCompleted: number;
  totalNoShows: number;
}

export function getWorkerProfile(): Promise<WorkerProfileDetails> {
  return apiFetch('/worker-profile/me');
}

export interface UpsertWorkerProfileResponse {
  fullName: string;
  categoryIds: string[];
  photoUrl: string | null;
}

export function upsertWorkerProfile(
  fullName: string,
  categoryIds: string[],
  photoUrl?: string,
): Promise<UpsertWorkerProfileResponse> {
  return apiFetch('/worker-profile', {
    method: 'PUT',
    body: JSON.stringify({ fullName, categoryIds, photoUrl }),
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
