import { apiFetch } from '@shift/shared';

export interface Job {
  id: string;
  categoryId: string;
  description: string;
  requiresExperience: boolean;
  dressCode: string | null;
  toolsRequired: string | null;
  cnhCategory: string | null;
  cnhRequired: boolean;
  addressLabel: string;
  locationLat: number;
  locationLng: number;
  positionsTotal: number;
  positionsFilled: number;
  payAmount: string;
  startsAt: string;
  endsAt: string;
  applicationsCloseAt: string | null;
  status: string;
}

export function listMyJobs(): Promise<{ jobs: Job[] }> {
  return apiFetch('/jobs/mine');
}

export interface CreateJobInput {
  categoryId: string;
  description: string;
  requiresExperience: boolean;
  dressCode?: string;
  toolsRequired?: string;
  cnhCategory?: string;
  cnhRequired?: boolean;
  addressLabel: string;
  locationLat: number;
  locationLng: number;
  positionsTotal: number;
  payAmount: string;
  startsAt: string;
  endsAt: string;
  /** Vazio/ausente = fecha automaticamente 1h antes do início. */
  applicationsCloseAt?: string;
}

export function createJob(input: CreateJobInput): Promise<Job> {
  return apiFetch('/jobs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type UpdateJobInput = CreateJobInput;

export function updateJob(jobId: string, input: UpdateJobInput): Promise<Job> {
  return apiFetch(`/jobs/${jobId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function cancelJob(jobId: string): Promise<Job> {
  return apiFetch(`/jobs/${jobId}/cancel`, {
    method: 'POST',
  });
}
