import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';

type ReviewStatus = 'approved' | 'rejected';

function isReviewStatus(value: string): value is ReviewStatus {
  return value === 'approved' || value === 'rejected';
}

export interface ReviewCompanyResult {
  id: string;
  verificationStatus: string;
}

/**
 * UPDATE condicional (WHERE verification_status = 'pending') fecha a corrida de duas revisões simultâneas.
 * `reason` é obrigatório pra rejeitar — é o que a empresa vê no lugar do
 * badge genérico "Verificação recusada" (ver get-company-profile.ts) e o
 * que fica registrado pro admin lembrar depois por que rejeitou.
 */
export async function reviewCompany(
  adminUserId: string,
  companyId: string,
  status: string | undefined,
  reason?: string,
): Promise<ReviewCompanyResult> {
  if (!status || !isReviewStatus(status)) {
    throw new HttpError(400, 'Status inválido — use "approved" ou "rejected".');
  }
  if (status === 'rejected' && !reason?.trim()) {
    throw new HttpError(400, 'É preciso informar o motivo da rejeição.');
  }

  const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
  if (!company) {
    throw new HttpError(404, 'Empresa não encontrada.');
  }
  if (company.verificationStatus !== 'pending') {
    throw new HttpError(400, 'Essa empresa já foi revisada.');
  }

  const [updated] = await db
    .update(companies)
    .set({
      verificationStatus: status,
      rejectionReason: status === 'rejected' ? reason!.trim() : null,
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(companies.id, companyId), eq(companies.verificationStatus, 'pending')))
    .returning();
  if (!updated) {
    throw new HttpError(400, 'Essa empresa já foi revisada.');
  }

  return { id: updated.id, verificationStatus: updated.verificationStatus };
}
