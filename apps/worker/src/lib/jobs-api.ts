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
  offersMeal: boolean;
  offersTransport: boolean;
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

export interface NearbyJob extends Job {
  distanceKm: number;
  companyName: string;
  companyLogoUrl: string | null;
  companyAvgRating: string | null;
  companyAvgCategoryScores: Record<string, string> | null;
  matchesSkills: boolean;
  experienceMismatch: boolean;
  cnhMismatch: boolean;
}

export function listNearbyJobs(): Promise<{ jobs: NearbyJob[] }> {
  return apiFetch('/jobs/nearby');
}

export interface JobDetail extends Job {
  companyName: string;
  companyLogoUrl: string | null;
  companyAvgRating: string | null;
  matchesSkills: boolean;
  experienceMismatch: boolean;
  cnhMismatch: boolean;
  hasApplied: boolean;
}

export function getJobDetail(jobId: string): Promise<JobDetail> {
  return apiFetch(`/jobs/${jobId}`);
}

export interface ApplicationResponse {
  id: string;
  jobId: string;
  workerId: string;
  status: string;
  createdAt: string;
}

export function applyToJob(jobId: string): Promise<ApplicationResponse> {
  return apiFetch(`/jobs/${jobId}/applications`, { method: 'POST' });
}
