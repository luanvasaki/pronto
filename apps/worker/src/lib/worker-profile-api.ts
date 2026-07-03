import { apiFetch } from '@shift/shared';

export interface SkillCategory {
  id: string;
  name: string;
}

export function listSkillCategories(): Promise<{ categories: SkillCategory[] }> {
  return apiFetch('/skill-categories');
}

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
