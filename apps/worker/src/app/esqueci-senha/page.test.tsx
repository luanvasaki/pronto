import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EsqueciSenhaPage from './page';

const forgotPasswordMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    forgotPassword: (...args: unknown[]) => forgotPasswordMock(...args),
  };
});

describe('EsqueciSenhaPage', () => {
  beforeEach(() => {
    forgotPasswordMock.mockReset();
  });

  it('começa com o botão desabilitado', () => {
    render(<EsqueciSenhaPage />);

    expect(screen.getByRole('button', { name: /enviar link/i })).toBeDisabled();
  });

  it('mostra a mesma mensagem de sucesso mesmo se o email não existir (API sempre 200)', async () => {
    forgotPasswordMock.mockResolvedValue({ message: 'ok' });
    const user = userEvent.setup();
    render(<EsqueciSenhaPage />);

    await user.type(screen.getByLabelText(/e-mail/i), 'ninguem@example.com');
    await user.click(screen.getByRole('button', { name: /enviar link/i }));

    expect(await screen.findByText(/verifique seu e-mail/i)).toBeInTheDocument();
    expect(forgotPasswordMock).toHaveBeenCalledWith('ninguem@example.com');
  });
});
