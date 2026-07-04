import { apiFetch } from '@shift/shared';

export interface JobApplication {
  id: string;
  status: string;
  createdAt: string;
  worker: {
    id: string;
    fullName: string;
    avgRating: string | null;
  };
  shift: {
    id: string;
    status: string;
    checkInAt: string | null;
    checkOutAt: string | null;
  } | null;
}

export function listJobApplications(jobId: string): Promise<{ applications: JobApplication[] }> {
  return apiFetch(`/jobs/${jobId}/applications`);
}

export interface ApplicationResponse {
  id: string;
  jobId: string;
  workerId: string;
  status: string;
  createdAt: string;
}

export function updateApplicationStatus(
  applicationId: string,
  status: 'approved' | 'rejected',
): Promise<ApplicationResponse> {
  return apiFetch(`/applications/${applicationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
