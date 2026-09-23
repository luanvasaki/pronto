import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { users } from '../../db/schema';

export interface AdminUser {
  id: string;
  email: string | null;
  fullName: string | null;
  createdAt: Date;
}

export async function listAdmins(): Promise<AdminUser[]> {
  return db
    .select({ id: users.id, email: users.email, fullName: users.fullName, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.isAdmin, true))
    .orderBy(desc(users.createdAt));
}
