import { apiFetch } from '@shift/shared';
import { Job } from './jobs-api';

export interface Shift {
  id: string;
  applicationId: string;
  jobId: string;
  workerId: string;
  status: string;
  payAmountSnapshot: string;
  checkInAt: string | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkOutAt: string | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  job: Job;
}

export function listMyShifts(): Promise<{ shifts: Shift[] }> {
  return apiFetch('/shifts/mine');
}

export function checkIn(shiftId: string, lat: number, lng: number): Promise<Shift> {
  return apiFetch(`/shifts/${shiftId}/check-in`, {
    method: 'POST',
    body: JSON.stringify({ lat, lng }),
  });
}

export function checkOut(shiftId: string, lat: number, lng: number): Promise<Shift> {
  return apiFetch(`/shifts/${shiftId}/check-out`, {
    method: 'POST',
    body: JSON.stringify({ lat, lng }),
  });
}
