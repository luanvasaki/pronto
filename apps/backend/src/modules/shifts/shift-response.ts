import { shifts } from '../../db/schema';

type ShiftRow = typeof shifts.$inferSelect;

export interface ShiftResponse {
  id: string;
  applicationId: string;
  jobId: string;
  workerId: string;
  status: string;
  payAmountSnapshot: string;
  checkInAt: Date | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkOutAt: Date | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
}

export function toShiftResponse(shift: ShiftRow): ShiftResponse {
  return {
    id: shift.id,
    applicationId: shift.applicationId,
    jobId: shift.jobId,
    workerId: shift.workerId,
    status: shift.status,
    payAmountSnapshot: shift.payAmountSnapshot,
    checkInAt: shift.checkInAt,
    checkInLat: shift.checkInLat,
    checkInLng: shift.checkInLng,
    checkOutAt: shift.checkOutAt,
    checkOutLat: shift.checkOutLat,
    checkOutLng: shift.checkOutLng,
  };
}
