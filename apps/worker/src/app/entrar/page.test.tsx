import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EntrarPage from './page';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe('EntrarPage', () => {
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

  it('vai pra tela de código com o celular em E.164 e codificado na URL', async () => {
    const user = userEvent.setup();
    render(<EntrarPage />);

    await user.type(screen.getByLabelText(/celular/i), '11999990000');
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    expect(pushMock).toHaveBeenCalledWith('/entrar/codigo?phone=%2B5511999990000');
  });
});
