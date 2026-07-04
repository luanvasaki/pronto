import { apiFetch } from '@shift/shared';

export interface NearbyJob {
  id: string;
  categoryId: string;
  description: string;
  addressLabel: string;
  locationLat: number;
  locationLng: number;
  positionsTotal: number;
  positionsFilled: number;
  payAmount: string;
  startsAt: string;
  endsAt: string;
  status: string;
  distanceKm: number;
}

export function listNearbyJobs(): Promise<{ jobs: NearbyJob[] }> {
  return apiFetch('/jobs/nearby');
}
