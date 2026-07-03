import { ApiError } from '@shift/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CodigoPage from './page';

const replaceMock = vi.fn();
const pushMock = vi.fn();
let searchParamsValue = new URLSearchParams({ phone: '+5511999990000' });

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => searchParamsValue,
}));

const verifyOtpMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
  };
});

describe('CodigoPage', () => {
  beforeEach(() => {
    searchParamsValue = new URLSearchParams({ phone: '+5511999990000' });
    replaceMock.mockClear();
    pushMock.mockClear();
    verifyOtpMock.mockReset();
  });

  it('mostra o celular recebido pela URL', () => {
    render(<CodigoPage />);

    expect(screen.getByText(/\+5511999990000/)).toBeInTheDocument();
  });

  it('começa com o botão desabilitado', () => {
    render(<CodigoPage />);

    expect(screen.getByRole('button', { name: /confirmar/i })).toBeDisabled();
  });

  it('habilita o botão só com exatamente 6 dígitos', async () => {
    const user = userEvent.setup();
    render(<CodigoPage />);
    const input = screen.getByLabelText(/código/i);

    await user.type(input, '12345');
    expect(screen.getByRole('button', { name: /confirmar/i })).toBeDisabled();

    await user.type(input, '6');
    expect(screen.getByRole('button', { name: /confirmar/i })).toBeEnabled();
  });

  it('redireciona pra /entrar se não houver celular na URL', () => {
    searchParamsValue = new URLSearchParams();

    render(<CodigoPage />);

    expect(replaceMock).toHaveBeenCalledWith('/entrar');
  });

  it('chama verifyOtp e navega pro painel quando o código está certo', async () => {
    verifyOtpMock.mockResolvedValue({ user: { id: '1' }, isNewUser: false });
    const user = userEvent.setup();
    render(<CodigoPage />);

    await user.type(screen.getByLabelText(/código/i), '123456');
    await user.click(screen.getByRole('button', { name: /confirmar/i }));

    // Sucesso navega pra outra página (na app real, esta desmonta) —
    // o mock de router não desmonta nada, então só confirmamos a
    // chamada em vez de esperar o botão "reabilitar".
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/painel'));
    expect(verifyOtpMock).toHaveBeenCalledWith('+5511999990000', '123456');
  });

  it('mostra a mensagem da API quando o código está errado', async () => {
    verifyOtpMock.mockRejectedValue(new ApiError(401, 'Código inválido ou expirado.'));
    const user = userEvent.setup();
    render(<CodigoPage />);

    await user.type(screen.getByLabelText(/código/i), '000000');
    await user.click(screen.getByRole('button', { name: /confirmar/i }));

    expect(await screen.findByText('Código inválido ou expirado.')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
