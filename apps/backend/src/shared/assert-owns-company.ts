import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { companies } from '../db/schema';
import { HttpError } from './errors/http-error';

/**
 * Confirma que `userId` é dono da empresa `companyId` — lança 403 com
 * `deniedMessage` se não for (empresa inexistente conta como "não é
 * dono", mesmo efeito prático). Mesma checagem que se repetia em ~10
 * módulos diferentes (vagas, candidaturas, turnos, avaliações, avisos,
 * perguntas) — cada chamador já buscou o `job`/`shift`/`application`
 * relevante antes, aqui só falta confirmar que quem chamou é o dono da
 * empresa daquela vaga.
 */
export async function assertOwnsCompany(userId: string, companyId: string, deniedMessage: string): Promise<void> {
  const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
  if (!company || company.ownerUserId !== userId) {
    throw new HttpError(403, deniedMessage);
  }
}
