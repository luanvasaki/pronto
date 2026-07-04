export { ApiError, apiFetch } from './api';
export { getCurrentUser, refreshSession, requestOtp, verifyOtp } from './auth-api';
export type { UserResponse, VerifyOtpResponse } from './auth-api';
export { extractDigits } from './digits';
export { isValidOtpCode } from './otp-code';
export { isValidBrazilianPhone, toE164 } from './phone';
export { listSkillCategories } from './skill-categories-api';
export type { SkillCategory } from './skill-categories-api';
