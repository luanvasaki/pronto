import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CodigoPage from './page';

const replaceMock = vi.fn();
let searchParamsValue = new URLSearchParams({ phone: '+5511999990000' });

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  useSearchParams: () => searchParamsValue,
}));

describe('CodigoPage', () => {
  beforeEach(() => {
    searchParamsValue = new URLSearchParams({ phone: '+5511999990000' });
    replaceMock.mockClear();
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
});
