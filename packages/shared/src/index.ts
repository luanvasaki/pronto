export { ApiError, apiFetch } from './api';
export { requestOtp, verifyOtp } from './auth-api';
export type { VerifyOtpResponse } from './auth-api';
export { extractDigits } from './digits';
export { isValidOtpCode } from './otp-code';
export { isValidBrazilianPhone, toE164 } from './phone';
