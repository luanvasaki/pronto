import { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { requireAdmin } from './require-admin';

// Fixtures únicas entre arquivos de teste (ver README).
const ADMIN_PHONE = '+5511966660040';
const NON_ADMIN_PHONE = '+5511966660041';

function fakeResponse(): Response {
  return {} as Response;
}

describe('requireAdmin', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, ADMIN_PHONE));
    await db.delete(users).where(eq(users.phone, NON_ADMIN_PHONE));
  });

  it('rejeita sem sessão', async () => {
    const req = { auth: undefined } as Request;
    const next = vi.fn();

    await requireAdmin(req, fakeResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('rejeita usuário que não é admin', async () => {
    const [user] = await db.insert(users).values({ phone: NON_ADMIN_PHONE }).returning();
    const req = { auth: { userId: user.id } } as Request;
    const next = vi.fn();

    await requireAdmin(req, fakeResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('segue adiante quando o usuário é admin', async () => {
    const [user] = await db.insert(users).values({ phone: ADMIN_PHONE, isAdmin: true }).returning();
    const req = { auth: { userId: user.id } } as Request;
    const next = vi.fn();

    await requireAdmin(req, fakeResponse(), next);

    expect(next).toHaveBeenCalledWith();
  });
});
