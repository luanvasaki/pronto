import { ApiError } from '@shift/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EntrarPage from './page';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
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
const logoutMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    login: (...args: unknown[]) => loginMock(...args),
    googleLogin: (...args: unknown[]) => googleLoginMock(...args),
    getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
    logout: (...args: unknown[]) => logoutMock(...args),
  };
});

describe('EntrarPage', () => {
  beforeEach(() => {
    pushMock.mockClear();
    loginMock.mockReset();
    googleLoginMock.mockReset();
    getCurrentUserMock.mockReset();
    logoutMock.mockReset().mockResolvedValue(undefined);
  });

  it('começa com o botão desabilitado', () => {
    render(<EntrarPage />);

    expect(screen.getByRole('button', { name: /entrar/i })).toBeDisabled();
  });

  it('habilita o botão quando email e senha estão preenchidos', async () => {
    const user = userEvent.setup();
    render(<EntrarPage />);

    await user.type(screen.getByLabelText(/e-mail/i), 'admin@pronto.com');
    await user.type(screen.getByLabelText(/senha/i), 'minha-senha');

    expect(screen.getByRole('button', { name: /entrar/i })).toBeEnabled();
  });

  it('loga e navega pro admin quando a conta tem isAdmin', async () => {
    loginMock.mockResolvedValue({ user: { id: '1', email: 'admin@pronto.com' } });
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: true } });
    const user = userEvent.setup();
    render(<EntrarPage />);

    await user.type(screen.getByLabelText(/e-mail/i), 'admin@pronto.com');
    await user.type(screen.getByLabelText(/senha/i), 'minha-senha');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/admin'));
    expect(loginMock).toHaveBeenCalledWith('admin@pronto.com', 'minha-senha');
    expect(logoutMock).not.toHaveBeenCalled();
  });

  it('recusa e desloga quando a conta loga certo mas não é admin', async () => {
    loginMock.mockResolvedValue({ user: { id: '2', email: 'dono@empresa.com' } });
    getCurrentUserMock.mockResolvedValue({ user: { id: '2', isAdmin: false } });
    const user = userEvent.setup();
    render(<EntrarPage />);

    await user.type(screen.getByLabelText(/e-mail/i), 'dono@empresa.com');
    await user.type(screen.getByLabelText(/senha/i), 'minha-senha');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText('Essa conta não tem acesso de administrador.')).toBeInTheDocument();
    expect(logoutMock).toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('recusa e desloga o login com Google quando a conta não é admin', async () => {
    googleLoginMock.mockResolvedValue({ user: { id: '2' } });
    getCurrentUserMock.mockResolvedValue({ user: { id: '2', isAdmin: false } });
    const user = userEvent.setup();
    render(<EntrarPage />);

    await user.click(screen.getByRole('button', { name: /simular sucesso do google/i }));

    expect(await screen.findByText('Essa conta não tem acesso de administrador.')).toBeInTheDocument();
    expect(logoutMock).toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('loga com Google e navega pro admin quando a conta tem isAdmin', async () => {
    googleLoginMock.mockResolvedValue({ user: { id: '1' } });
    getCurrentUserMock.mockResolvedValue({ user: { id: '1', isAdmin: true } });
    const user = userEvent.setup();
    render(<EntrarPage />);

    await user.click(screen.getByRole('button', { name: /simular sucesso do google/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/admin'));
  });

  it('mostra a mensagem da API e não navega quando o login falha', async () => {
    loginMock.mockRejectedValue(new ApiError(401, 'E-mail ou senha inválidos.'));
    const user = userEvent.setup();
    render(<EntrarPage />);

    await user.type(screen.getByLabelText(/e-mail/i), 'admin@pronto.com');
    await user.type(screen.getByLabelText(/senha/i), 'senha-errada');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText('E-mail ou senha inválidos.')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('mostra mensagem genérica quando o erro não é da API', async () => {
    loginMock.mockRejectedValue(new Error('falha de rede'));
    const user = userEvent.setup();
    render(<EntrarPage />);

    await user.type(screen.getByLabelText(/e-mail/i), 'admin@pronto.com');
    await user.type(screen.getByLabelText(/senha/i), 'minha-senha');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText('Não foi possível entrar.')).toBeInTheDocument();
  });
});
