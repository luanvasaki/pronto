import { apiFetch, Rating, ShiftRatings } from '@shift/shared';
import { Job } from './jobs-api';

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
  checkInConfirmedAt: string | null;
  checkOutAt: string | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  checkOutConfirmedAt: string | null;
  job: Job;
  companyName: string;
  payment: Payment | null;
  ratings: ShiftRatings;
}

export function listMyShifts(): Promise<{ shifts: Shift[] }> {
  return apiFetch('/shifts/mine');
}

export function checkIn(shiftId: string): Promise<Shift> {
  return apiFetch(`/shifts/${shiftId}/check-in`, { method: 'POST' });
}

export function checkOut(shiftId: string): Promise<Shift> {
  return apiFetch(`/shifts/${shiftId}/check-out`, { method: 'POST' });
}

export function confirmPayment(shiftId: string, received: boolean): Promise<Payment> {
  return apiFetch(`/shifts/${shiftId}/payment/confirm`, {
    method: 'POST',
    body: JSON.stringify({ received }),
  });
}
