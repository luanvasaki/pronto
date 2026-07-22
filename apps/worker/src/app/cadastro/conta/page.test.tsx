import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@shift/shared';
import CadastroContaPage from './page';

const pushMock = vi.fn();
const backMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, back: backMock }),
}));

const registerMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    register: (...args: unknown[]) => registerMock(...args),
  };
});

describe('CadastroContaPage', () => {
  beforeEach(() => {
    pushMock.mockClear();
    backMock.mockClear();
    registerMock.mockReset();
  });

  it('começa com o botão desabilitado', () => {
    render(<CadastroContaPage />);

    expect(screen.getByRole('button', { name: /criar conta/i })).toBeDisabled();
  });

  it('mostra "Passo 1 de 4" e volta com o botão de voltar', async () => {
    const user = userEvent.setup();
    render(<CadastroContaPage />);

    expect(screen.getByText('Passo 1 de 4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Voltar' }));

    expect(backMock).toHaveBeenCalled();
  });

  it('mantém o botão desabilitado se as senhas não coincidem', async () => {
    const user = userEvent.setup();
    render(<CadastroContaPage />);

    await user.type(screen.getByLabelText(/^e-mail$/i), 'pessoa@example.com');
    await user.type(screen.getByLabelText(/^senha$/i), '12345678');
    await user.type(screen.getByLabelText(/confirme a senha/i), '87654321');

    expect(screen.getByText('As senhas não coincidem.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /criar conta/i })).toBeDisabled();
  });

  it('chama register e navega pra tela de termos quando a API responde bem', async () => {
    registerMock.mockResolvedValue({ user: { id: '1', email: 'pessoa@example.com' } });
    const user = userEvent.setup();
    render(<CadastroContaPage />);

    await user.type(screen.getByLabelText(/^e-mail$/i), 'pessoa@example.com');
    await user.type(screen.getByLabelText(/^senha$/i), '12345678');
    await user.type(screen.getByLabelText(/confirme a senha/i), '12345678');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/cadastro/termos'));
    expect(registerMock).toHaveBeenCalledWith('pessoa@example.com', '12345678');
  });

  it('mostra a mensagem da API quando o registro falha (email duplicado)', async () => {
    registerMock.mockRejectedValue(new ApiError(409, 'Já existe uma conta com este e-mail.'));
    const user = userEvent.setup();
    render(<CadastroContaPage />);

    await user.type(screen.getByLabelText(/^e-mail$/i), 'pessoa@example.com');
    await user.type(screen.getByLabelText(/^senha$/i), '12345678');
    await user.type(screen.getByLabelText(/confirme a senha/i), '12345678');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(await screen.findByText('Já existe uma conta com este e-mail.')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
