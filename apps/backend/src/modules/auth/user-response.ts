import { users } from '../../db/schema';

export interface UserResponse {
  id: string;
  phone: string;
  status: string;
}

/** Extraído pra cá porque agora tem dois consumidores (verify-otp e GET /auth/me). */
export function toUserResponse(user: typeof users.$inferSelect): UserResponse {
  return { id: user.id, phone: user.phone, status: user.status };
}
