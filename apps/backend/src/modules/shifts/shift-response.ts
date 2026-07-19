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
  checkInConfirmedAt: Date | null;
  checkOutAt: Date | null;
  checkOutConfirmedAt: Date | null;
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
    checkInConfirmedAt: shift.checkInConfirmedAt,
    checkOutAt: shift.checkOutAt,
    checkOutConfirmedAt: shift.checkOutConfirmedAt,
  };
}
