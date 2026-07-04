import { apiFetch } from '@shift/shared';

export interface UpsertWorkerProfileResponse {
  fullName: string;
  categoryIds: string[];
}

export function upsertWorkerProfile(
  fullName: string,
  categoryIds: string[],
): Promise<UpsertWorkerProfileResponse> {
  return apiFetch('/worker-profile', {
    method: 'PUT',
    body: JSON.stringify({ fullName, categoryIds }),
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

export interface UpdateWorkerLocationResponse {
  homeLat: number;
  homeLng: number;
}

export function updateWorkerLocation(lat: number, lng: number): Promise<UpdateWorkerLocationResponse> {
  return apiFetch('/worker-profile/location', {
    method: 'PATCH',
    body: JSON.stringify({ lat, lng }),
  });
}
