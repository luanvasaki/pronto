import { apiFetch } from '@shift/shared';

export interface WorkerHistoryEntry {
  workerId: string;
  fullName: string;
  photoUrl: string | null;
  shiftsCompleted: number;
  noShowCount: number;
  attendanceRate: number | null;
  avgRatingGiven: string | null;
  lastWorkedAt: string | null;
}

export function getCompanyWorkerHistory(): Promise<{ workers: WorkerHistoryEntry[] }> {
  return apiFetch('/company-profile/worker-history');
}
