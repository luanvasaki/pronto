import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../client';
import { users } from './users';

describe('tabela users', () => {
  afterEach(async () => {
    await db.delete(users).where(eq(users.phone, '+5511999990000'));
  });

  it('cria um usuário com status "active" por padrão', async () => {
    const [created] = await db
      .insert(users)
      .values({ phone: '+5511999990000' })
      .returning();

    expect(created.status).toBe('active');
    expect(created.id).toBeTruthy();
  });

  it('não permite dois usuários com o mesmo telefone', async () => {
    await db.insert(users).values({ phone: '+5511999990000' });

    await expect(db.insert(users).values({ phone: '+5511999990000' })).rejects.toThrow();
  });
});
