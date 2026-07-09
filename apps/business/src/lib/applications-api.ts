import { apiFetch } from '@shift/shared';

export interface Payment {
  id: string;
  shiftId: string;
  amount: string;
  status: string;
  chargedAt: string | null;
  releasedAt: string | null;
  confirmedAt: string | null;
  disputedAt: string | null;
}

export interface Rating {
  id: string;
  shiftId: string;
  raterRole: string;
  score: number;
  comment: string | null;
  createdAt: string;
}

export interface ShiftRatings {
  worker: Rating | null;
  company: Rating | null;
}

export interface JobApplication {
  id: string;
  status: string;
  createdAt: string;
  experienceMismatch: boolean;
  worker: {
    id: string;
    fullName: string;
    photoUrl: string | null;
    avgRating: string | null;
    matchesSkills: boolean;
  };
  shift: {
    id: string;
    status: string;
    checkInAt: string | null;
    checkOutAt: string | null;
    payment: Payment | null;
    ratings: ShiftRatings;
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

export function rateShift(shiftId: string, score: number, comment: string | undefined): Promise<Rating> {
  return apiFetch(`/shifts/${shiftId}/rating`, {
    method: 'POST',
    body: JSON.stringify({ score, comment }),
  });
}

export function releasePayment(shiftId: string): Promise<Payment> {
  return apiFetch(`/shifts/${shiftId}/payment/release`, {
    method: 'POST',
  });
}
