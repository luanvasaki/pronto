import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, jobs, skillCategories } from '../../db/schema';
import { getLatestConsentDocument } from '../consent-documents/get-consent-document';
import { HttpError } from '../../shared/errors/http-error';
import { JobInput, validateJobInput } from './job-input-validation';
import { JobResponse, toJobResponse } from './job-response';

export type CreateJobInput = JobInput;

/** `db` de fora ou uma transação — mesmo formato aceito por `db.transaction`. */
type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface CreateJobConsent {
  termsAccepted: boolean | undefined;
  minorsTermsAccepted: boolean | undefined;
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * companyId sempre vem do dono autenticado, nunca do corpo da requisição.
 *
 * `consent` fica fora de `CreateJobInput`/`validateJobInput` de propósito:
 * é exigido só na criação, não faz sentido reenviado a cada edição (ver
 * updateJob, que reusa o mesmo validador de campos). `minorsTermsAccepted`
 * só é exigido quando `minorsAllowed` está ligado — é o aceite do termo
 * específico de habilitar candidaturas de 16-17 anos naquela vaga (ver
 * consent_documents type 'minors_opportunity').
 *
 * `dbClient` aceita uma transação (`db.transaction(async (tx) => ...)`) no
 * lugar da conexão default — usado por duplicateWeek pra criar várias vagas
 * atomicamente, sem duplicar as regras de negócio daqui.
 */
export async function createJob(
  ownerUserId: string,
  input: CreateJobInput,
  consent: CreateJobConsent,
  dbClient: DbClient = db,
): Promise<JobResponse> {
  const company = await dbClient.query.companies.findFirst({ where: eq(companies.ownerUserId, ownerUserId) });
  if (!company) {
    throw new HttpError(400, 'Complete o cadastro da empresa antes de publicar uma vaga.');
  }
  if (company.verificationStatus !== 'approved') {
    throw new HttpError(403, 'Complete a verificação da empresa antes de publicar vagas.');
  }
  if (!consent.termsAccepted) {
    throw new HttpError(400, 'É preciso confirmar que essa escala é intermediação avulsa antes de publicar.');
  }

  const validated = validateJobInput(input);

  if (validated.minorsAllowed && !consent.minorsTermsAccepted) {
    throw new HttpError(400, 'É preciso aceitar o termo de habilitar candidaturas de 16-17 anos.');
  }

  const category = await dbClient.query.skillCategories.findFirst({
    where: eq(skillCategories.id, validated.categoryId),
  });
  if (!category) {
    throw new HttpError(400, 'Categoria inválida.');
  }

  const latestTerms = await getLatestConsentDocument('platform_terms');
  const latestMinorsTerms = validated.minorsAllowed ? await getLatestConsentDocument('minors_opportunity') : null;

  const [job] = await dbClient
    .insert(jobs)
    .values({
      companyId: company.id,
      categoryId: validated.categoryId,
      description: validated.description,
      requiresExperience: validated.requiresExperience,
      dressCode: validated.dressCode,
      toolsRequired: validated.toolsRequired,
      cnhCategory: validated.cnhCategory,
      cnhRequired: validated.cnhRequired,
      mealProvision: validated.mealProvision,
      mealAmount: validated.mealAmount,
      transportProvision: validated.transportProvision,
      transportAmount: validated.transportAmount,
      minorsAllowed: validated.minorsAllowed,
      addressLabel: validated.addressLabel,
      locationLat: validated.locationLat,
      locationLng: validated.locationLng,
      positionsTotal: validated.positionsTotal,
      payAmount: validated.payAmount,
      startsAt: validated.startsAt,
      endsAt: validated.endsAt,
      applicationsCloseAt: validated.applicationsCloseAt,
      termsAcceptedAt: new Date(),
      termsVersion: latestTerms.version,
      termsIpAddress: consent.ipAddress,
      termsUserAgent: consent.userAgent,
      ...(latestMinorsTerms
        ? {
            minorsTermsAcceptedAt: new Date(),
            minorsTermsVersion: latestMinorsTerms.version,
            minorsTermsIpAddress: consent.ipAddress,
            minorsTermsUserAgent: consent.userAgent,
          }
        : {}),
    })
    .returning();

  if (!job) {
    throw new HttpError(500, 'Não foi possível criar a vaga.');
  }

  return toJobResponse(job);
}
