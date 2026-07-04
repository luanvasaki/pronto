import { apiFetch } from '@shift/shared';

export interface Job {
  id: string;
  categoryId: string;
  description: string;
  addressLabel: string;
  locationLat: number;
  locationLng: number;
  positionsTotal: number;
  positionsFilled: number;
  payAmount: string;
  startsAt: string;
  endsAt: string;
  status: string;
}

export function listMyJobs(): Promise<{ jobs: Job[] }> {
  return apiFetch('/jobs/mine');
}

export interface CreateJobInput {
  categoryId: string;
  description: string;
  addressLabel: string;
  locationLat: number;
  locationLng: number;
  positionsTotal: number;
  payAmount: string;
  startsAt: string;
  endsAt: string;
}

export function createJob(input: CreateJobInput): Promise<Job> {
  return apiFetch('/jobs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
