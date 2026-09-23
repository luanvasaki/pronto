import { env } from '../../config/env';
import { users } from '../../db/schema';

export interface UserResponse {
  id: string;
  email: string;
  status: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  googlePhotoUrl: string | null;
  fullName: string | null;
}

/**
 * `email` é nullable no schema (fixtures de teste de outros domínios
 * inserem usuário sem email), mas todo usuário que chega até aqui
 * passou por register/login/google-login — que sempre preenchem esse
 * campo — daí o non-null assertion.
 *
 * `isSuperAdmin` só existe pro front decidir se mostra a UI de
 * promover/revogar outros admins (ver require-super-admin.ts) — o
 * backend sempre reconfere na rota, isso aqui não concede acesso.
 */
export function toUserResponse(user: typeof users.$inferSelect): UserResponse {
  return {
    id: user.id,
    email: user.email!,
    status: user.status,
    isAdmin: user.isAdmin,
    isSuperAdmin: user.email ? env.superAdminEmails.includes(user.email.toLowerCase()) : false,
    googlePhotoUrl: user.googlePhotoUrl,
    fullName: user.fullName,
  };
}
