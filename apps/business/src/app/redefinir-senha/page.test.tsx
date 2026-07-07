import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@shift/shared';
import RedefinirSenhaPage from './page';

const pushMock = vi.fn();
let searchParams = new URLSearchParams({ token: 'token-valido' });
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParams,
}));

const resetPasswordMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    resetPassword: (...args: unknown[]) => resetPasswordMock(...args),
  };
});

describe('RedefinirSenhaPage', () => {
  beforeEach(() => {
    pushMock.mockClear();
    resetPasswordMock.mockReset();
    searchParams = new URLSearchParams({ token: 'token-valido' });
  });

  it('mostra erro e não renderiza o formulário sem token na URL', () => {
    searchParams = new URLSearchParams();
    render(<RedefinirSenhaPage />);

    expect(screen.getByText(/link de redefinição inválido/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/nova senha/i)).not.toBeInTheDocument();
  });

  it('mantém o botão desabilitado se as senhas não coincidem', async () => {
    const user = userEvent.setup();
    render(<RedefinirSenhaPage />);

    await user.type(screen.getByLabelText(/^nova senha$/i), '12345678');
    await user.type(screen.getByLabelText(/confirme a nova senha/i), '87654321');

    expect(screen.getByRole('button', { name: /redefinir senha/i })).toBeDisabled();
  });

  it('chama resetPassword com o token da URL e navega pro login', async () => {
    resetPasswordMock.mockResolvedValue({ message: 'ok' });
    const user = userEvent.setup();
    render(<RedefinirSenhaPage />);

    await user.type(screen.getByLabelText(/^nova senha$/i), '12345678');
    await user.type(screen.getByLabelText(/confirme a nova senha/i), '12345678');
    await user.click(screen.getByRole('button', { name: /redefinir senha/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/entrar'));
    expect(resetPasswordMock).toHaveBeenCalledWith('token-valido', '12345678');
  });

  it('mostra a mensagem da API quando o token é inválido/expirado', async () => {
    resetPasswordMock.mockRejectedValue(new ApiError(401, 'Link de redefinição inválido ou expirado.'));
    const user = userEvent.setup();
    render(<RedefinirSenhaPage />);

    await user.type(screen.getByLabelText(/^nova senha$/i), '12345678');
    await user.type(screen.getByLabelText(/confirme a nova senha/i), '12345678');
    await user.click(screen.getByRole('button', { name: /redefinir senha/i }));

    expect(await screen.findByText('Link de redefinição inválido ou expirado.')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
