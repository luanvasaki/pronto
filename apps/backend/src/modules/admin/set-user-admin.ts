import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { adminActions, users } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';

export interface SetUserAdminResult {
  id: string;
  email: string | null;
  isAdmin: boolean;
}

/**
 * Único caminho pra conceder/revogar isAdmin fora de update direto no
 * banco — só alcançável por quem passa requireSuperAdmin (ver
 * admin.routes.ts e require-super-admin.ts). Toda chamada fica
 * registrada em admin_actions (quem, pra quem, quando), inclusive
 * quando o valor já era o mesmo — é uma ação explícita de um super
 * admin, vale o rastro mesmo sendo um no-op no `users`.
 */
export async function setUserAdmin(
  actorUserId: string,
  targetUserId: string,
  isAdmin: boolean,
): Promise<SetUserAdminResult> {
  if (targetUserId === actorUserId && !isAdmin) {
    throw new HttpError(400, 'Não é possível revogar seu próprio acesso de administrador.');
  }

  const target = await db.query.users.findFirst({ where: eq(users.id, targetUserId) });
  if (!target) {
    throw new HttpError(404, 'Usuário não encontrado.');
  }

  const [updated] = await db
    .update(users)
    .set({ isAdmin, updatedAt: new Date() })
    .where(eq(users.id, targetUserId))
    .returning();
  if (!updated) {
    throw new HttpError(404, 'Usuário não encontrado.');
  }

  await db.insert(adminActions).values({
    actorUserId,
    targetUserId,
    action: isAdmin ? 'grant_admin' : 'revoke_admin',
  });

  return { id: updated.id, email: updated.email, isAdmin: updated.isAdmin };
}
