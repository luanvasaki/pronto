import { apiFetch, Rating, ShiftRatings } from '@shift/shared';

export type { Rating, ShiftRatings };

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

export interface JobApplication {
  id: string;
  status: string;
  createdAt: string;
  removedAt: string | null;
  experienceMismatch: boolean;
  worker: {
    id: string;
    fullName: string;
    photoUrl: string | null;
    avgRating: string | null;
    avgCategoryScores: Record<string, string> | null;
    matchesSkills: boolean;
    previousShiftsWithCompany: number;
  };
  shift: {
    id: string;
    status: string;
    checkInAt: string | null;
    checkInConfirmedAt: string | null;
    checkOutAt: string | null;
    checkOutConfirmedAt: string | null;
    payment: Payment | null;
    ratings: ShiftRatings;
    companyRatingSkippedAt: string | null;
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

export function removeApprovedWorker(applicationId: string): Promise<ApplicationResponse> {
  return apiFetch(`/applications/${applicationId}/remove`, { method: 'PATCH' });
}

export function releasePayment(shiftId: string): Promise<Payment> {
  return apiFetch(`/shifts/${shiftId}/payment/release`, {
    method: 'POST',
  });
}

export interface ShiftConfirmationResponse {
  id: string;
  status: string;
  checkInConfirmedAt: string | null;
  checkOutConfirmedAt: string | null;
}

export function confirmCheckIn(shiftId: string): Promise<ShiftConfirmationResponse> {
  return apiFetch(`/shifts/${shiftId}/check-in/confirm`, { method: 'POST' });
}

export function confirmCheckOut(shiftId: string): Promise<ShiftConfirmationResponse> {
  return apiFetch(`/shifts/${shiftId}/check-out/confirm`, { method: 'POST' });
}

export interface SkipRatingResult {
  shiftId: string;
  companyRatingSkippedAt: string;
}

export function skipRating(shiftId: string): Promise<SkipRatingResult> {
  return apiFetch(`/shifts/${shiftId}/skip-rating`, { method: 'PATCH' });
}
