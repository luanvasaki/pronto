import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@shift/shared';
import CodigoPage from './page';

const replaceMock = vi.fn();
const pushMock = vi.fn();
let searchParamsValue = new URLSearchParams({ phone: '+5511999990000' });

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => searchParamsValue,
}));

const verifyOtpMock = vi.fn();
const requestOtpMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
    requestOtp: (...args: unknown[]) => requestOtpMock(...args),
  };
});

async function pasteCode(user: ReturnType<typeof userEvent.setup>, code: string): Promise<void> {
  await user.click(screen.getAllByRole('textbox')[0]);
  await user.paste(code);
}

describe('CodigoPage', () => {
  beforeEach(() => {
    searchParamsValue = new URLSearchParams({ phone: '+5511999990000' });
    replaceMock.mockClear();
    pushMock.mockClear();
    verifyOtpMock.mockReset();
    requestOtpMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
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

    await pasteCode(user, '12345');
    expect(screen.getByRole('button', { name: /confirmar/i })).toBeDisabled();

    await pasteCode(user, '123456');
    expect(screen.getByRole('button', { name: /confirmar/i })).toBeEnabled();
  });

  it('redireciona pra /entrar se não houver celular na URL', () => {
    searchParamsValue = new URLSearchParams();

    render(<CodigoPage />);

    expect(replaceMock).toHaveBeenCalledWith('/entrar');
  });

  it('chama verifyOtp e navega quando o código está certo', async () => {
    verifyOtpMock.mockResolvedValue({ user: { id: '1' }, isNewUser: false });
    const user = userEvent.setup();
    render(<CodigoPage />);

    await pasteCode(user, '123456');
    await user.click(screen.getByRole('button', { name: /confirmar/i }));

    // Sucesso navega pra outra página (na app real, esta desmonta) —
    // o mock de router não desmonta nada, então só confirmamos a
    // chamada em vez de esperar o botão "reabilitar".
    expect(pushMock).toHaveBeenCalledWith('/cadastro');
    expect(verifyOtpMock).toHaveBeenCalledWith('+5511999990000', '123456');
  });

  it('mostra a mensagem da API quando o código está errado', async () => {
    verifyOtpMock.mockRejectedValue(new ApiError(401, 'Código inválido ou expirado.'));
    const user = userEvent.setup();
    render(<CodigoPage />);

    await pasteCode(user, '000000');
    await user.click(screen.getByRole('button', { name: /confirmar/i }));

    expect(await screen.findByText('Código inválido ou expirado.')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('mostra o timer de reenvio e some o botão de reenviar antes de acabar', () => {
    render(<CodigoPage />);

    expect(screen.getByText('1:00')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reenviar código/i })).not.toBeInTheDocument();
  });

  it('permite reenviar o código depois que o timer zera', async () => {
    vi.useFakeTimers();
    requestOtpMock.mockResolvedValue({ message: 'ok' });
    render(<CodigoPage />);

    await vi.advanceTimersByTimeAsync(60_000);

    const resendButton = screen.getByRole('button', { name: /reenviar código/i });
    vi.useRealTimers();
    const user = userEvent.setup();
    await user.click(resendButton);

    expect(requestOtpMock).toHaveBeenCalledWith('+5511999990000');
    expect(await screen.findByText('1:00')).toBeInTheDocument();
  });
});
