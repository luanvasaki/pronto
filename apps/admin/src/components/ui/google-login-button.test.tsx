import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  GoogleLogin: () => <button type="button">Entrar com Google (mock)</button>,
}));

describe('GoogleLoginButton', () => {
  const originalClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  afterEach(() => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = originalClientId;
    vi.resetModules();
  });

  it('não renderiza nada sem NEXT_PUBLIC_GOOGLE_CLIENT_ID configurada', async () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    vi.resetModules();
    const { GoogleLoginButton: FreshComponent } = await import('./google-login-button');

    const { container } = render(<FreshComponent onSuccess={vi.fn()} onError={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renderiza o botão quando NEXT_PUBLIC_GOOGLE_CLIENT_ID está configurada', async () => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'test-client-id';
    vi.resetModules();
    const { GoogleLoginButton: FreshComponent } = await import('./google-login-button');

    render(<FreshComponent onSuccess={vi.fn()} onError={vi.fn()} />);

    expect(screen.getByRole('button', { name: /entrar com google/i })).toBeInTheDocument();
  });
});
