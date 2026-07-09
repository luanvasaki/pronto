import { apiFetch } from '@shift/shared';
import { Job } from './jobs-api';

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
  payment: Payment | null;
  ratings: ShiftRatings;
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

export function rateShift(shiftId: string, score: number, comment: string | undefined): Promise<Rating> {
  return apiFetch(`/shifts/${shiftId}/rating`, {
    method: 'POST',
    body: JSON.stringify({ score, comment }),
  });
}

export function confirmPayment(shiftId: string, received: boolean): Promise<Payment> {
  return apiFetch(`/shifts/${shiftId}/payment/confirm`, {
    method: 'POST',
    body: JSON.stringify({ received }),
  });
}
