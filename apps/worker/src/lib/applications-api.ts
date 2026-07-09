import { apiFetch } from '@shift/shared';
import { Job } from './jobs-api';

export interface MyApplication {
  id: string;
  status: string;
  workerSeenAt: string | null;
  createdAt: string;
  job: Job;
  companyName: string;
}

export function listMyApplications(): Promise<{ applications: MyApplication[] }> {
  return apiFetch('/applications/mine');
}

export interface ApplicationResponse {
  id: string;
  jobId: string;
  workerId: string;
  status: string;
  workerSeenAt: string | null;
  createdAt: string;
}

export function markApplicationSeen(applicationId: string): Promise<ApplicationResponse> {
  return apiFetch(`/applications/${applicationId}/seen`, { method: 'PATCH' });
}
