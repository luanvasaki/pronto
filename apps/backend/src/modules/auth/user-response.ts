import { users } from '../../db/schema';

export interface UserResponse {
  id: string;
  email: string;
  status: string;
  isAdmin: boolean;
  googlePhotoUrl: string | null;
}

/**
 * `email` é nullable no schema (fixtures de teste de outros domínios
 * inserem usuário sem email), mas todo usuário que chega até aqui
 * passou por register/login/google-login — que sempre preenchem esse
 * campo — daí o non-null assertion.
 */
export function toUserResponse(user: typeof users.$inferSelect): UserResponse {
  return {
    id: user.id,
    email: user.email!,
    status: user.status,
    isAdmin: user.isAdmin,
    googlePhotoUrl: user.googlePhotoUrl,
  };
}
