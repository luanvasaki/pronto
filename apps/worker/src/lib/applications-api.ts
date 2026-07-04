import { apiFetch } from '@shift/shared';
import { Job } from './jobs-api';

export interface MyApplication {
  id: string;
  status: string;
  createdAt: string;
  job: Job;
}

export function listMyApplications(): Promise<{ applications: MyApplication[] }> {
  return apiFetch('/applications/mine');
}
