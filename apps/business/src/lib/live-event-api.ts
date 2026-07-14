import { apiFetch } from '@shift/shared';

export type LiveShiftStatus = 'aguardando' | 'atrasado' | 'chegou' | 'concluido';

export interface LiveShiftEntry {
  shiftId: string;
  workerId: string;
  workerName: string;
  workerPhotoUrl: string | null;
  status: LiveShiftStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  minutesLate: number | null;
}

export interface LiveEventJob {
  jobId: string;
  categoryName: string;
  addressLabel: string;
  startsAt: string;
  endsAt: string;
  positionsTotal: number;
  positionsFilled: number;
  shifts: LiveShiftEntry[];
}

export interface LiveEventStatus {
  jobs: LiveEventJob[];
}

export function getLiveEventStatus(dayStart: Date, dayEnd: Date): Promise<LiveEventStatus> {
  const params = new URLSearchParams({ dayStart: dayStart.toISOString(), dayEnd: dayEnd.toISOString() });
  return apiFetch(`/company-profile/live-event?${params.toString()}`);
}
