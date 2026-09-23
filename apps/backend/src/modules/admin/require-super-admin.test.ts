import { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/client';
import { users } from '../../db/schema';

vi.mock('../../config/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config/env')>();
  return { env: { ...actual.env, superAdminEmails: ['super@example.com'] } };
});

const { requireSuperAdmin } = await import('./require-super-admin');

// Fixtures únicas entre arquivos de teste (ver README).
const SUPER_ADMIN_PHONE = '+5511966660050';
const REGULAR_ADMIN_PHONE = '+5511966660051';

function fakeResponse(): Response {
  return {} as Response;
}

describe('requireSuperAdmin', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, SUPER_ADMIN_PHONE));
    await db.delete(users).where(eq(users.phone, REGULAR_ADMIN_PHONE));
  });

  it('rejeita sem sessão', async () => {
    const req = { auth: undefined } as Request;
    const next = vi.fn();

    await requireSuperAdmin(req, fakeResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('rejeita admin cujo e-mail não está na lista de super admins', async () => {
    const [user] = await db
      .insert(users)
      .values({ phone: REGULAR_ADMIN_PHONE, email: 'nao-super@example.com', isAdmin: true })
      .returning();
    const req = { auth: { userId: user.id } } as Request;
    const next = vi.fn();

    await requireSuperAdmin(req, fakeResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('segue adiante quando o e-mail do usuário está na lista de super admins', async () => {
    const [user] = await db
      .insert(users)
      .values({ phone: SUPER_ADMIN_PHONE, email: 'super@example.com', isAdmin: true })
      .returning();
    const req = { auth: { userId: user.id } } as Request;
    const next = vi.fn();

    await requireSuperAdmin(req, fakeResponse(), next);

    expect(next).toHaveBeenCalledWith();
  });
});
