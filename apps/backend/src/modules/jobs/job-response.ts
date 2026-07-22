import { jobs } from '../../db/schema';

type JobRow = typeof jobs.$inferSelect;

export interface JobResponse {
  id: string;
  categoryId: string;
  description: string;
  requiresExperience: boolean;
  dressCode: string | null;
  toolsRequired: string | null;
  cnhCategory: string | null;
  cnhRequired: boolean;
  mealProvision: string;
  mealAmount: string | null;
  transportProvision: string;
  transportAmount: string | null;
  minorsAllowed: boolean;
  // Não expõe o timestamp/versão/IP em si (auditoria fica só no banco) —
  // só se já existe aceite registrado, pra o front saber que não precisa
  // pedir o termo de novo numa edição que mantém minorsAllowed ligado.
  hasMinorsTermsAccepted: boolean;
  addressLabel: string;
  locationLat: number;
  locationLng: number;
  positionsTotal: number;
  positionsFilled: number;
  payAmount: string;
  startsAt: Date;
  endsAt: Date;
  applicationsCloseAt: Date | null;
  status: string;
}

export function toJobResponse(job: JobRow): JobResponse {
  return {
    id: job.id,
    categoryId: job.categoryId,
    description: job.description,
    requiresExperience: job.requiresExperience,
    dressCode: job.dressCode,
    toolsRequired: job.toolsRequired,
    cnhCategory: job.cnhCategory,
    cnhRequired: job.cnhRequired,
    mealProvision: job.mealProvision,
    mealAmount: job.mealAmount,
    transportProvision: job.transportProvision,
    transportAmount: job.transportAmount,
    minorsAllowed: job.minorsAllowed,
    hasMinorsTermsAccepted: job.minorsTermsAcceptedAt !== null,
    addressLabel: job.addressLabel,
    locationLat: job.locationLat,
    locationLng: job.locationLng,
    positionsTotal: job.positionsTotal,
    positionsFilled: job.positionsFilled,
    payAmount: job.payAmount,
    startsAt: job.startsAt,
    endsAt: job.endsAt,
    applicationsCloseAt: job.applicationsCloseAt,
    status: job.status,
  };
}
