import { ApiError } from '@shift/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EntrarPage from './page';

const pushMock = vi.fn();
const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

vi.mock('../../components/ui/google-login-button', () => ({
  GoogleLoginButton: ({ onSuccess }: { onSuccess: (idToken: string) => void }) => (
    <button type="button" onClick={() => onSuccess('fake-id-token')}>
      Simular sucesso do Google
    </button>
  ),
}));

const loginMock = vi.fn();
const googleLoginMock = vi.fn();
const getCurrentUserMock = vi.fn();
const refreshSessionMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    login: (...args: unknown[]) => loginMock(...args),
    googleLogin: (...args: unknown[]) => googleLoginMock(...args),
    getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
    refreshSession: (...args: unknown[]) => refreshSessionMock(...args),
  };
});

describe('EntrarPage', () => {
  beforeEach(() => {
    pushMock.mockClear();
    replaceMock.mockClear();
    loginMock.mockReset();
    googleLoginMock.mockReset();
    // Sem sessão por padrão — mostra o formulário. Teste específico de
    // sessão já ativa (app instalado reaberto) sobrescreve isso.
    getCurrentUserMock.mockReset().mockRejectedValue(new Error('401'));
    refreshSessionMock.mockReset().mockRejectedValue(new Error('sem refresh token'));
  });

  it('chama googleLogin só com o idToken, sem checkbox de termos na tela de entrar', async () => {
    googleLoginMock.mockResolvedValue({ user: { id: '1' } });
    const user = userEvent.setup();
    render(<EntrarPage />);

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /simular sucesso do google/i }));

    await waitFor(() => expect(googleLoginMock).toHaveBeenCalledWith('fake-id-token'));
  });

  it('começa com o botão desabilitado', async () => {
    render(<EntrarPage />);

    expect(await screen.findByRole('button', { name: /entrar/i })).toBeDisabled();
  });

  it('habilita o botão quando email e senha estão preenchidos', async () => {
    const user = userEvent.setup();
    render(<EntrarPage />);

    await user.type(await screen.findByLabelText(/e-mail/i), 'pessoa@example.com');
    await user.type(screen.getByLabelText(/senha/i), 'minha-senha');

    expect(screen.getByRole('button', { name: /entrar/i })).toBeEnabled();
  });

  it('chama login e navega pro painel quando a API responde bem', async () => {
    loginMock.mockResolvedValue({ user: { id: '1', email: 'pessoa@example.com' } });
    const user = userEvent.setup();
    render(<EntrarPage />);

    await user.type(await screen.findByLabelText(/e-mail/i), 'pessoa@example.com');
    await user.type(screen.getByLabelText(/senha/i), 'minha-senha');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/painel'));
    expect(loginMock).toHaveBeenCalledWith('pessoa@example.com', 'minha-senha');
  });

  it('mostra a mensagem da API e não navega quando o login falha', async () => {
    loginMock.mockRejectedValue(new ApiError(401, 'E-mail ou senha inválidos.'));
    const user = userEvent.setup();
    render(<EntrarPage />);

    await user.type(await screen.findByLabelText(/e-mail/i), 'pessoa@example.com');
    await user.type(screen.getByLabelText(/senha/i), 'senha-errada');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText('E-mail ou senha inválidos.')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('mostra mensagem genérica quando o erro não é da API', async () => {
    loginMock.mockRejectedValue(new Error('falha de rede'));
    const user = userEvent.setup();
    render(<EntrarPage />);

    await user.type(await screen.findByLabelText(/e-mail/i), 'pessoa@example.com');
    await user.type(screen.getByLabelText(/senha/i), 'minha-senha');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText('Não foi possível entrar.')).toBeInTheDocument();
  });

  it('pula o formulário e navega pro painel quando o app reabre com sessão já válida', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1' } });

    render(<EntrarPage />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/painel'));
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/e-mail/i)).not.toBeInTheDocument();
  });
});
