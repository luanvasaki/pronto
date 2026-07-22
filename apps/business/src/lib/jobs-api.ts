import { apiFetch, BenefitProvision } from '@shift/shared';

export interface Job {
  id: string;
  categoryId: string;
  description: string;
  requiresExperience: boolean;
  dressCode: string | null;
  toolsRequired: string | null;
  cnhCategory: string | null;
  cnhRequired: boolean;
  mealProvision: BenefitProvision;
  mealAmount: string | null;
  transportProvision: BenefitProvision;
  transportAmount: string | null;
  minorsAllowed: boolean;
  hasMinorsTermsAccepted: boolean;
  addressLabel: string;
  locationLat: number;
  locationLng: number;
  positionsTotal: number;
  positionsFilled: number;
  payAmount: string;
  startsAt: string;
  endsAt: string;
  applicationsCloseAt: string | null;
  status: string;
}

export function listMyJobs(): Promise<{ jobs: Job[] }> {
  return apiFetch('/jobs/mine');
}

export interface CreateJobInput {
  categoryId: string;
  description: string;
  requiresExperience: boolean;
  dressCode?: string;
  toolsRequired?: string;
  cnhCategory?: string;
  cnhRequired?: boolean;
  mealProvision?: BenefitProvision;
  mealAmount?: string;
  transportProvision?: BenefitProvision;
  transportAmount?: string;
  minorsAllowed?: boolean;
  addressLabel: string;
  locationLat: number;
  locationLng: number;
  positionsTotal: number;
  payAmount: string;
  startsAt: string;
  endsAt: string;
  /** Vazio/ausente = fecha automaticamente 1h antes do início. */
  applicationsCloseAt?: string;
}

export function createJob(
  input: CreateJobInput,
  termsAccepted: boolean,
  minorsTermsAccepted?: boolean,
): Promise<Job> {
  return apiFetch('/jobs', {
    method: 'POST',
    body: JSON.stringify({ ...input, termsAccepted, minorsTermsAccepted }),
  });
}

export type UpdateJobInput = CreateJobInput;

export function updateJob(jobId: string, input: UpdateJobInput, minorsTermsAccepted?: boolean): Promise<Job> {
  return apiFetch(`/jobs/${jobId}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...input, minorsTermsAccepted }),
  });
}

export function cancelJob(jobId: string): Promise<Job> {
  return apiFetch(`/jobs/${jobId}/cancel`, {
    method: 'POST',
  });
}

export interface GeocodeJobAddressResult {
  lat: number | null;
  lng: number | null;
}

export function geocodeJobAddress(addressLabel: string): Promise<GeocodeJobAddressResult> {
  return apiFetch('/jobs/geocode-address', {
    method: 'POST',
    body: JSON.stringify({ addressLabel }),
  });
}

export interface DuplicateWeekInput {
  /** Início (00:00) da semana de origem, no fuso local — mesmo dia usado como âncora da grade. */
  sourceWeekStart: string;
  /** Início (00:00) da semana de destino. */
  targetWeekStart: string;
}

export function duplicateWeek(
  input: DuplicateWeekInput,
  termsAccepted: boolean,
  minorsTermsAccepted?: boolean,
): Promise<{ jobs: Job[] }> {
  return apiFetch('/jobs/duplicate-week', {
    method: 'POST',
    body: JSON.stringify({ ...input, termsAccepted, minorsTermsAccepted }),
  });
}
