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
const uploadCompanyDocumentMock = vi.fn();
vi.mock('../../lib/company-profile-api', () => ({
  upsertCompanyProfile: (...args: unknown[]) => upsertCompanyProfileMock(...args),
  uploadCompanyDocument: (...args: unknown[]) => uploadCompanyDocumentMock(...args),
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
    uploadCompanyDocumentMock.mockReset();
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

  it('mantém o botão desabilitado quando o CNPJ tem 14 dígitos mas o dígito verificador é inválido', async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);

    await user.type(screen.getByLabelText('Razão social'), 'Bar do Zé Ltda');
    await user.type(screen.getByLabelText('Nome fantasia'), 'Bar do Zé');
    await user.type(screen.getByLabelText('CNPJ'), '11111111111111');

    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();
  });

  it('ignora caracteres que não são número e aplica a máscara no CNPJ', async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);

    await user.type(screen.getByLabelText('CNPJ'), 'ab11222333000181xy');

    expect(screen.getByLabelText('CNPJ')).toHaveValue('11.222.333/0001-81');
  });

  it('salva o perfil e navega pro painel quando a API responde bem', async () => {
    upsertCompanyProfileMock.mockResolvedValue({ id: '1', verificationStatus: 'pending' });
    const user = userEvent.setup();
    render(<CadastroPage />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/painel'));
    expect(upsertCompanyProfileMock).toHaveBeenCalledWith({
      legalName: 'Bar do Zé Ltda',
      tradeName: 'Bar do Zé',
      personType: 'juridica',
      cnpj: '11222333000181',
      cpf: undefined,
    });
    expect(uploadCompanyDocumentMock).not.toHaveBeenCalled();
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

  describe('pessoa física', () => {
    async function switchToPessoaFisica(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('button', { name: /pessoa física \(cpf\)/i }));
    }

    it('troca os campos pra Nome completo, Como quer aparecer e CPF', async () => {
      const user = userEvent.setup();
      render(<CadastroPage />);

      await switchToPessoaFisica(user);

      expect(screen.getByLabelText('Nome completo')).toBeInTheDocument();
      expect(screen.getByLabelText('Como quer aparecer')).toBeInTheDocument();
      expect(screen.getByLabelText('CPF')).toBeInTheDocument();
      expect(screen.queryByLabelText('CNPJ')).not.toBeInTheDocument();
    });

    it('mantém o botão desabilitado quando o CPF tem 11 dígitos mas o dígito verificador é inválido', async () => {
      const user = userEvent.setup();
      render(<CadastroPage />);

      await switchToPessoaFisica(user);
      await user.type(screen.getByLabelText('Nome completo'), 'Ana Souza');
      await user.type(screen.getByLabelText('Como quer aparecer'), 'Ana Freelas');
      await user.type(screen.getByLabelText('CPF'), '11111111111');
      const file = new File(['doc'], 'rg.jpg', { type: 'image/jpeg' });
      await user.upload(screen.getByLabelText(/toque para escolher uma foto/i), file);

      expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();
    });

    it('exige o documento pra habilitar o botão', async () => {
      const user = userEvent.setup();
      render(<CadastroPage />);

      await switchToPessoaFisica(user);
      await user.type(screen.getByLabelText('Nome completo'), 'Ana Souza');
      await user.type(screen.getByLabelText('Como quer aparecer'), 'Ana Freelas');
      await user.type(screen.getByLabelText('CPF'), '52998224725');
      expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();

      const file = new File(['doc'], 'rg.jpg', { type: 'image/jpeg' });
      await user.upload(screen.getByLabelText(/toque para escolher uma foto/i), file);
      expect(screen.getByRole('button', { name: /continuar/i })).toBeEnabled();
    });

    it('salva o perfil como pessoa física e envia o documento', async () => {
      upsertCompanyProfileMock.mockResolvedValue({ id: '1', verificationStatus: 'pending' });
      uploadCompanyDocumentMock.mockResolvedValue({ id: 'doc-1' });
      const user = userEvent.setup();
      render(<CadastroPage />);

      await switchToPessoaFisica(user);
      await user.type(screen.getByLabelText('Nome completo'), 'Ana Souza');
      await user.type(screen.getByLabelText('Como quer aparecer'), 'Ana Freelas');
      await user.type(screen.getByLabelText('CPF'), '52998224725');
      const file = new File(['doc'], 'rg.jpg', { type: 'image/jpeg' });
      await user.upload(screen.getByLabelText(/toque para escolher uma foto/i), file);
      await user.click(screen.getByRole('button', { name: /continuar/i }));

      await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/painel'));
      expect(upsertCompanyProfileMock).toHaveBeenCalledWith({
        legalName: 'Ana Souza',
        tradeName: 'Ana Freelas',
        personType: 'fisica',
        cnpj: undefined,
        cpf: '52998224725',
      });
      expect(uploadCompanyDocumentMock).toHaveBeenCalledWith(file);
    });

    it('quando o envio do documento falha, tentar de novo não reenvia o perfil', async () => {
      upsertCompanyProfileMock.mockResolvedValue({ id: '1', verificationStatus: 'pending' });
      uploadCompanyDocumentMock.mockRejectedValueOnce(new Error('falha de rede'));
      const user = userEvent.setup();
      render(<CadastroPage />);

      await switchToPessoaFisica(user);
      await user.type(screen.getByLabelText('Nome completo'), 'Ana Souza');
      await user.type(screen.getByLabelText('Como quer aparecer'), 'Ana Freelas');
      await user.type(screen.getByLabelText('CPF'), '52998224725');
      const file = new File(['doc'], 'rg.jpg', { type: 'image/jpeg' });
      await user.upload(screen.getByLabelText(/toque para escolher uma foto/i), file);
      await user.click(screen.getByRole('button', { name: /continuar/i }));

      expect(
        await screen.findByText('Cadastro salvo, mas não foi possível enviar o documento. Tente enviar de novo.'),
      ).toBeInTheDocument();
      expect(pushMock).not.toHaveBeenCalled();
      expect(upsertCompanyProfileMock).toHaveBeenCalledTimes(1);

      uploadCompanyDocumentMock.mockResolvedValueOnce({ id: 'doc-1' });
      await user.click(screen.getByRole('button', { name: /continuar/i }));

      await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/painel'));
      // Perfil não foi salvo de novo na segunda tentativa — só o documento.
      expect(upsertCompanyProfileMock).toHaveBeenCalledTimes(1);
      expect(uploadCompanyDocumentMock).toHaveBeenCalledTimes(2);
    });
  });
});
