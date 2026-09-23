import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../db/client';
import { adminActions, users } from '../../db/schema';
import { HttpError } from '../../shared/errors/http-error';
import { setUserAdmin } from './set-user-admin';

const ACTOR_PHONE = '+5511966660060';
const TARGET_PHONE = '+5511966660061';

describe('setUserAdmin', () => {
  afterEach(async () => {
    const actor = await db.query.users.findFirst({ where: eq(users.phone, ACTOR_PHONE) });
    const target = await db.query.users.findFirst({ where: eq(users.phone, TARGET_PHONE) });
    if (actor) await db.delete(adminActions).where(eq(adminActions.actorUserId, actor.id));
    await db.delete(users).where(eq(users.phone, ACTOR_PHONE));
    await db.delete(users).where(eq(users.phone, TARGET_PHONE));
    void target;
  });

  it('concede isAdmin e registra a ação de auditoria', async () => {
    const [actor] = await db.insert(users).values({ phone: ACTOR_PHONE, isAdmin: true }).returning();
    const [target] = await db.insert(users).values({ phone: TARGET_PHONE }).returning();

    const result = await setUserAdmin(actor.id, target.id, true);

    expect(result.isAdmin).toBe(true);

    const updated = await db.query.users.findFirst({ where: eq(users.id, target.id) });
    expect(updated?.isAdmin).toBe(true);

    const actions = await db.query.adminActions.findMany({ where: eq(adminActions.targetUserId, target.id) });
    expect(actions).toHaveLength(1);
    expect(actions[0].actorUserId).toBe(actor.id);
    expect(actions[0].action).toBe('grant_admin');
  });

  it('revoga isAdmin de outro usuário', async () => {
    const [actor] = await db.insert(users).values({ phone: ACTOR_PHONE, isAdmin: true }).returning();
    const [target] = await db.insert(users).values({ phone: TARGET_PHONE, isAdmin: true }).returning();

    const result = await setUserAdmin(actor.id, target.id, false);

    expect(result.isAdmin).toBe(false);
    const actions = await db.query.adminActions.findMany({ where: eq(adminActions.targetUserId, target.id) });
    expect(actions[0].action).toBe('revoke_admin');
  });

  it('recusa revogar o próprio acesso', async () => {
    const [actor] = await db.insert(users).values({ phone: ACTOR_PHONE, isAdmin: true }).returning();

    await expect(setUserAdmin(actor.id, actor.id, false)).rejects.toThrow(HttpError);

    const unchanged = await db.query.users.findFirst({ where: eq(users.id, actor.id) });
    expect(unchanged?.isAdmin).toBe(true);
  });

  it('recusa usuário-alvo inexistente', async () => {
    const [actor] = await db.insert(users).values({ phone: ACTOR_PHONE, isAdmin: true }).returning();

    await expect(setUserAdmin(actor.id, '00000000-0000-0000-0000-000000000000', true)).rejects.toThrow(HttpError);
  });
});
