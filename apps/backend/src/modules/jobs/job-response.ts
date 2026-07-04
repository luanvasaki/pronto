import { jobs } from '../../db/schema';

type JobRow = typeof jobs.$inferSelect;

export interface JobResponse {
  id: string;
  categoryId: string;
  description: string;
  addressLabel: string;
  locationLat: number;
  locationLng: number;
  positionsTotal: number;
  positionsFilled: number;
  payAmount: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
}

export function toJobResponse(job: JobRow): JobResponse {
  return {
    id: job.id,
    categoryId: job.categoryId,
    description: job.description,
    addressLabel: job.addressLabel,
    locationLat: job.locationLat,
    locationLng: job.locationLng,
    positionsTotal: job.positionsTotal,
    positionsFilled: job.positionsFilled,
    payAmount: job.payAmount,
    startsAt: job.startsAt,
    endsAt: job.endsAt,
    status: job.status,
  };
}
