import { ApiError } from '@shift/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CadastroPage from './page';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

const upsertCompanyProfileMock = vi.fn();
vi.mock('../../lib/company-profile-api', () => ({
  upsertCompanyProfile: (...args: unknown[]) => upsertCompanyProfileMock(...args),
}));

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Razão social'), 'Bar do Zé Ltda');
  await user.type(screen.getByLabelText('Nome fantasia'), 'Bar do Zé');
  await user.type(screen.getByLabelText('CNPJ'), '11222333000181');
}

describe('CadastroPage', () => {
  beforeEach(() => {
    pushMock.mockClear();
    upsertCompanyProfileMock.mockReset();
  });

  it('começa com o botão desabilitado', () => {
    render(<CadastroPage />);

    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();
  });

  it('habilita o botão só quando todos os campos ficam válidos', async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);

    await user.type(screen.getByLabelText('Razão social'), 'Bar do Zé Ltda');
    await user.type(screen.getByLabelText('Nome fantasia'), 'Bar do Zé');
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();

    await user.type(screen.getByLabelText('CNPJ'), '11222333000181');
    expect(screen.getByRole('button', { name: /continuar/i })).toBeEnabled();
  });

  it('ignora caracteres que não são número no CNPJ', async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);

    await user.type(screen.getByLabelText('CNPJ'), '11.222.333/0001-81');

    expect(screen.getByLabelText('CNPJ')).toHaveValue('11222333000181');
  });

  it('salva o perfil e navega pro painel quando a API responde bem', async () => {
    upsertCompanyProfileMock.mockResolvedValue({ id: '1', verificationStatus: 'pending' });
    const user = userEvent.setup();
    render(<CadastroPage />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/painel'));
    expect(upsertCompanyProfileMock).toHaveBeenCalledWith('Bar do Zé Ltda', 'Bar do Zé', '11222333000181');
  });

  it('mostra a mensagem da API quando salvar falha', async () => {
    upsertCompanyProfileMock.mockRejectedValue(new ApiError(400, 'Esse CNPJ já está cadastrado.'));
    const user = userEvent.setup();
    render(<CadastroPage />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    expect(await screen.findByText('Esse CNPJ já está cadastrado.')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
