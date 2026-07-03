import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();
vi.mock('./api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const { requestOtp, verifyOtp, getCurrentUser, refreshSession } = await import('./auth-api');

describe('requestOtp', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama /auth/otp/request com o celular no corpo', async () => {
    apiFetchMock.mockResolvedValue({ message: 'ok' });

    await requestOtp('+5511999990000');

    expect(apiFetchMock).toHaveBeenCalledWith('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ phone: '+5511999990000' }),
    });
  });
});

describe('verifyOtp', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama /auth/otp/verify com celular e código no corpo', async () => {
    apiFetchMock.mockResolvedValue({ user: { id: '1' }, isNewUser: true });

    await verifyOtp('+5511999990000', '123456');

    expect(apiFetchMock).toHaveBeenCalledWith('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone: '+5511999990000', code: '123456' }),
    });
  });
});

describe('getCurrentUser', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama GET /auth/me', async () => {
    apiFetchMock.mockResolvedValue({ user: { id: '1' } });

    await getCurrentUser();

    expect(apiFetchMock).toHaveBeenCalledWith('/auth/me');
  });
});

describe('refreshSession', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama POST /auth/refresh', async () => {
    apiFetchMock.mockResolvedValue({ success: true });

    await refreshSession();

    expect(apiFetchMock).toHaveBeenCalledWith('/auth/refresh', { method: 'POST' });
  });
});
