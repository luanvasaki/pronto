import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../client';
import { users } from './users';

const TEST_EMAIL = 'users-schema-test@example.com';

describe('tabela users', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.email, TEST_EMAIL));
  });

  it('cria um usuário com status "active" por padrão', async () => {
    const [created] = await db
      .insert(users)
      .values({ email: TEST_EMAIL })
      .returning();

    expect(created.status).toBe('active');
    expect(created.id).toBeTruthy();
    expect(created.phone).toBeNull();
  });

  it('não permite dois usuários com o mesmo email', async () => {
    await db.insert(users).values({ email: TEST_EMAIL });

    await expect(db.insert(users).values({ email: TEST_EMAIL })).rejects.toThrow();
  });

  it('permite mais de um usuário sem telefone (phone nulo não conflita)', async () => {
    const [first] = await db.insert(users).values({ email: TEST_EMAIL }).returning();

    await expect(
      db.insert(users).values({ email: 'users-schema-test-2@example.com' }),
    ).resolves.toBeDefined();

    await db.delete(users).where(eq(users.email, 'users-schema-test-2@example.com'));
    expect(first.phone).toBeNull();
  });
});
