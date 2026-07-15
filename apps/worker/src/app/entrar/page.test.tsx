import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@shift/shared';
import EntrarPage from './page';

const pushMock = vi.fn();
const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

vi.mock('../../components/ui/google-login-button', () => ({
  GoogleLoginButton: ({ onSuccess, onError }: { onSuccess: (idToken: string) => void; onError: () => void }) => (
    <div>
      <button type="button" onClick={() => onSuccess('fake-id-token')}>
        Simular sucesso do Google
      </button>
      <button type="button" onClick={onError}>
        Simular erro do Google
      </button>
    </div>
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
    // Sem sessão por padrão — mostra o formulário. Testes específicos
    // de sessão já ativa (app instalado reaberto) sobrescrevem isso.
    getCurrentUserMock.mockReset().mockRejectedValue(new Error('401'));
    refreshSessionMock.mockReset().mockRejectedValue(new Error('sem refresh token'));
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

  it('chama login e navega pra tela inicial quando a API responde bem', async () => {
    loginMock.mockResolvedValue({ user: { id: '1', email: 'pessoa@example.com' } });
    const user = userEvent.setup();
    render(<EntrarPage />);

    await user.type(await screen.findByLabelText(/e-mail/i), 'pessoa@example.com');
    await user.type(screen.getByLabelText(/senha/i), 'minha-senha');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/inicio'));
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

  it('mostra o erro do Google no próprio slot, não junto do erro de senha', async () => {
    const user = userEvent.setup();
    render(<EntrarPage />);

    await user.click(await screen.findByRole('button', { name: /simular erro do google/i }));

    expect(await screen.findByText('Não foi possível entrar com o Google.')).toBeInTheDocument();
    // O campo de senha não deve mostrar esse erro — ele é sobre o login com Google, não sobre a senha.
    expect(screen.getByLabelText(/senha/i)).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('manda o aceite dos termos pro login com Google quando o checkbox está marcado', async () => {
    googleLoginMock.mockResolvedValue({ user: { id: '1' } });
    const user = userEvent.setup();
    render(<EntrarPage />);

    await user.click(await screen.findByRole('checkbox'));
    await user.click(await screen.findByRole('button', { name: /simular sucesso do google/i }));

    await waitFor(() => expect(googleLoginMock).toHaveBeenCalledWith('fake-id-token', true));
  });

  it('não manda o aceite dos termos pro login com Google quando o checkbox não está marcado', async () => {
    googleLoginMock.mockResolvedValue({ user: { id: '1' } });
    const user = userEvent.setup();
    render(<EntrarPage />);

    await user.click(await screen.findByRole('button', { name: /simular sucesso do google/i }));

    await waitFor(() => expect(googleLoginMock).toHaveBeenCalledWith('fake-id-token', false));
  });

  it('mostra a mensagem da API no slot do Google quando o login com Google falha', async () => {
    googleLoginMock.mockRejectedValue(new ApiError(400, 'Termos ainda não aceitos.'));
    const user = userEvent.setup();
    render(<EntrarPage />);

    await user.click(await screen.findByRole('button', { name: /simular sucesso do google/i }));

    expect(await screen.findByText('Termos ainda não aceitos.')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('limpa o erro do Google ao tentar o login normal, e vice-versa', async () => {
    loginMock.mockRejectedValue(new ApiError(401, 'E-mail ou senha inválidos.'));
    const user = userEvent.setup();
    render(<EntrarPage />);

    await user.click(await screen.findByRole('button', { name: /simular erro do google/i }));
    expect(await screen.findByText('Não foi possível entrar com o Google.')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/e-mail/i), 'pessoa@example.com');
    await user.type(screen.getByLabelText(/senha/i), 'senha-errada');
    await user.click(screen.getByRole('button', { name: /^entrar$/i }));

    expect(await screen.findByText('E-mail ou senha inválidos.')).toBeInTheDocument();
    expect(screen.queryByText('Não foi possível entrar com o Google.')).not.toBeInTheDocument();
  });

  it('pula o formulário e navega pra tela inicial quando o app reabre com sessão já válida', async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: '1' } });

    render(<EntrarPage />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/inicio'));
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/e-mail/i)).not.toBeInTheDocument();
  });
});
