import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@shift/shared';
import EntrarPage from './page';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

const requestOtpMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    requestOtp: (...args: unknown[]) => requestOtpMock(...args),
  };
});

describe('EntrarPage', () => {
  beforeEach(() => {
    pushMock.mockClear();
    requestOtpMock.mockReset();
  });

  it('começa com o botão desabilitado', () => {
    render(<EntrarPage />);

    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();
  });

  it('habilita o botão só quando o celular fica válido', async () => {
    const user = userEvent.setup();
    render(<EntrarPage />);
    const input = screen.getByLabelText(/celular/i);

    await user.type(input, '119999900');
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();

    await user.type(input, '00');
    expect(screen.getByRole('button', { name: /continuar/i })).toBeEnabled();
  });

  it('ignora caracteres que não são número', async () => {
    const user = userEvent.setup();
    render(<EntrarPage />);

    await user.type(screen.getByLabelText(/celular/i), '(11) 99999-0000');

    expect(screen.getByLabelText(/celular/i)).toHaveValue('11999990000');
  });

  it('chama requestOtp e navega pra tela de código quando a API responde bem', async () => {
    requestOtpMock.mockResolvedValue({ message: 'ok' });
    const user = userEvent.setup();
    render(<EntrarPage />);

    await user.type(screen.getByLabelText(/celular/i), '11999990000');
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    // Sucesso navega pra outra página (na app real, esta desmonta) —
    // o mock de router não desmonta nada, então só confirmamos a
    // chamada em vez de esperar o botão "reabilitar".
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/entrar/codigo?phone=%2B5511999990000'));
    expect(requestOtpMock).toHaveBeenCalledWith('+5511999990000');
  });

  it('mostra a mensagem da API e não navega quando o pedido falha', async () => {
    requestOtpMock.mockRejectedValue(new ApiError(429, 'Aguarde antes de pedir um novo código.'));
    const user = userEvent.setup();
    render(<EntrarPage />);

    await user.type(screen.getByLabelText(/celular/i), '11999990000');
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    expect(await screen.findByText('Aguarde antes de pedir um novo código.')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('mostra mensagem genérica quando o erro não é da API', async () => {
    requestOtpMock.mockRejectedValue(new Error('falha de rede'));
    const user = userEvent.setup();
    render(<EntrarPage />);

    await user.type(screen.getByLabelText(/celular/i), '11999990000');
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    expect(await screen.findByText('Não foi possível enviar o código.')).toBeInTheDocument();
  });
});
