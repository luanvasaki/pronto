import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();
vi.mock('./api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const { register, login, googleLogin, forgotPassword, resetPassword, getCurrentUser, refreshSession, logout } =
  await import('./auth-api');

describe('register', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama POST /auth/register com email e senha no corpo', async () => {
    apiFetchMock.mockResolvedValue({ user: { id: '1' } });

    await register('pessoa@example.com', 'senha12345');

    expect(apiFetchMock).toHaveBeenCalledWith('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'pessoa@example.com', password: 'senha12345' }),
    });
  });
});

describe('login', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama POST /auth/login com email e senha no corpo', async () => {
    apiFetchMock.mockResolvedValue({ user: { id: '1' } });

    await login('pessoa@example.com', 'senha12345');

    expect(apiFetchMock).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'pessoa@example.com', password: 'senha12345' }),
    });
  });
});

describe('googleLogin', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama POST /auth/google com o idToken no corpo', async () => {
    apiFetchMock.mockResolvedValue({ user: { id: '1' } });

    await googleLogin('token-do-google');

    expect(apiFetchMock).toHaveBeenCalledWith('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken: 'token-do-google' }),
    });
  });
});

describe('forgotPassword', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama POST /auth/forgot-password com o email no corpo', async () => {
    apiFetchMock.mockResolvedValue({ message: 'ok' });

    await forgotPassword('pessoa@example.com');

    expect(apiFetchMock).toHaveBeenCalledWith('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'pessoa@example.com' }),
    });
  });
});

describe('resetPassword', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama POST /auth/reset-password com token e nova senha no corpo', async () => {
    apiFetchMock.mockResolvedValue({ message: 'ok' });

    await resetPassword('token-abc', 'senha-nova-123');

    expect(apiFetchMock).toHaveBeenCalledWith('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'token-abc', newPassword: 'senha-nova-123' }),
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

describe('logout', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('chama POST /auth/logout', async () => {
    apiFetchMock.mockResolvedValue({ message: 'ok' });

    await logout();

    expect(apiFetchMock).toHaveBeenCalledWith('/auth/logout', { method: 'POST' });
  });
});
