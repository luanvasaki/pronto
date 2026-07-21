import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@shift/shared';
import CadastroPage from './page';

const pushMock = vi.fn();
const backMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, back: backMock }),
}));

const listSkillCategoriesMock = vi.fn();
const getCurrentUserMock = vi.fn();
const createSkillCategoryMock = vi.fn();
vi.mock('@shift/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shift/shared')>();
  return {
    ...actual,
    listSkillCategories: (...args: unknown[]) => listSkillCategoriesMock(...args),
    getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
    createSkillCategory: (...args: unknown[]) => createSkillCategoryMock(...args),
  };
});

const upsertWorkerProfileMock = vi.fn();
const uploadWorkerPhotoMock = vi.fn();
vi.mock('../../lib/worker-profile-api', () => ({
  upsertWorkerProfile: (...args: unknown[]) => upsertWorkerProfileMock(...args),
  uploadWorkerPhoto: (...args: unknown[]) => uploadWorkerPhotoMock(...args),
}));

const CATEGORIES = [
  { id: 'cat-1', name: 'Garçom' },
  { id: 'cat-2', name: 'Cozinha' },
];

const NO_GOOGLE_PHOTO_USER = { id: 'u1', email: 'ana@example.com', status: 'active', isAdmin: false, googlePhotoUrl: null };

describe('CadastroPage', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  let createObjectURLCallCount = 0;

  beforeEach(() => {
    pushMock.mockClear();
    backMock.mockClear();
    listSkillCategoriesMock.mockReset().mockResolvedValue({ categories: CATEGORIES });
    getCurrentUserMock.mockReset().mockResolvedValue({ user: NO_GOOGLE_PHOTO_USER });
    upsertWorkerProfileMock.mockReset();
    uploadWorkerPhotoMock.mockReset();
    createSkillCategoryMock.mockReset();
    createObjectURLCallCount = 0;
    URL.createObjectURL = vi.fn().mockImplementation(() => `blob:mock-url-${createObjectURLCallCount++}`);
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('carrega e mostra as categorias', async () => {
    render(<CadastroPage />);

    expect(await screen.findByLabelText('Garçom')).toBeInTheDocument();
    expect(screen.getByLabelText('Cozinha')).toBeInTheDocument();
  });

  it('mostra erro quando as categorias falham ao carregar', async () => {
    listSkillCategoriesMock.mockReset().mockRejectedValue(new Error('falha'));

    render(<CadastroPage />);

    expect(await screen.findByText('Não foi possível carregar as categorias.')).toBeInTheDocument();
  });

  it('mostra "Passo 2 de 3" e volta com o botão de voltar', async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);

    expect(screen.getByText('Passo 2 de 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Voltar' }));

    expect(backMock).toHaveBeenCalled();
  });

  it('começa com o botão desabilitado e só habilita com nome + cpf + telefone + endereço + categoria (foto é opcional)', async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);
    await screen.findByLabelText('Garçom');

    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();

    await user.type(screen.getByLabelText('Nome completo'), 'Ana Souza');
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();

    await user.type(screen.getByLabelText('CPF'), '52998224725');
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();

    await user.type(screen.getByLabelText('Telefone'), '11912345678');
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();

    await user.type(screen.getByLabelText('Rua'), 'Rua das Flores');
    await user.type(screen.getByLabelText('Número'), '123');
    fireEvent.change(screen.getByLabelText('Data de nascimento'), { target: { value: '2000-01-01' } });
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();

    await user.click(screen.getByLabelText('Garçom'));
    expect(screen.getByRole('button', { name: /continuar/i })).toBeEnabled();
  });

  it('mantém o botão desabilitado quando o CPF tem 11 dígitos mas o dígito verificador é inválido', async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);
    await screen.findByLabelText('Garçom');

    await user.type(screen.getByLabelText('Nome completo'), 'Ana Souza');
    await user.type(screen.getByLabelText('CPF'), '11111111111');
    await user.type(screen.getByLabelText('Telefone'), '11912345678');
    await user.type(screen.getByLabelText('Rua'), 'Rua das Flores');
    await user.type(screen.getByLabelText('Número'), '123');
    fireEvent.change(screen.getByLabelText('Data de nascimento'), { target: { value: '2000-01-01' } });
    await user.click(screen.getByLabelText('Garçom'));

    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();
  });

  it('mantém o botão desabilitado e avisa quando o trabalhador é menor de 16 anos', async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);
    await screen.findByLabelText('Garçom');

    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
    const underageBirthDate = `${tenYearsAgo.getFullYear()}-${String(tenYearsAgo.getMonth() + 1).padStart(2, '0')}-${String(tenYearsAgo.getDate()).padStart(2, '0')}`;

    await user.type(screen.getByLabelText('Nome completo'), 'Ana Souza');
    await user.type(screen.getByLabelText('CPF'), '52998224725');
    await user.type(screen.getByLabelText('Telefone'), '11912345678');
    await user.type(screen.getByLabelText('Rua'), 'Rua das Flores');
    await user.type(screen.getByLabelText('Número'), '123');
    fireEvent.change(screen.getByLabelText('Data de nascimento'), { target: { value: underageBirthDate } });
    await user.click(screen.getByLabelText('Garçom'));

    expect(
      screen.getByText('É preciso ter 16 anos ou mais pra se cadastrar como trabalhador no Pronto.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();
    // Abaixo de 16 anos o cadastro já está bloqueado por outro motivo —
    // não faz sentido mostrar (nem exigir) o formulário do responsável,
    // que é só pra faixa de 16-17.
    expect(screen.queryByLabelText('Nome completo do responsável')).not.toBeInTheDocument();
    expect(screen.queryByText(/nome do responsável/i)).not.toBeInTheDocument();
  });

  describe('trabalhador entre 16 e 17 anos (exige dados do responsável)', () => {
    function seventeenYearsAgoBirthDate(): string {
      const seventeenYearsAgo = new Date();
      seventeenYearsAgo.setFullYear(seventeenYearsAgo.getFullYear() - 17);
      return `${seventeenYearsAgo.getFullYear()}-${String(seventeenYearsAgo.getMonth() + 1).padStart(2, '0')}-${String(seventeenYearsAgo.getDate()).padStart(2, '0')}`;
    }

    async function fillBaseFields(user: ReturnType<typeof userEvent.setup>): Promise<void> {
      await user.type(screen.getByLabelText('Nome completo'), 'Ana Souza');
      await user.type(screen.getByLabelText('CPF'), '52998224725');
      await user.type(screen.getByLabelText('Telefone'), '11912345678');
      await user.type(screen.getByLabelText('Rua'), 'Rua das Flores');
    await user.type(screen.getByLabelText('Número'), '123');
      fireEvent.change(screen.getByLabelText('Data de nascimento'), { target: { value: seventeenYearsAgoBirthDate() } });
      await user.click(screen.getByLabelText('Garçom'));
    }

    it('mostra o formulário do responsável e mantém o botão desabilitado até preencher tudo', async () => {
      const user = userEvent.setup();
      render(<CadastroPage />);
      await screen.findByLabelText('Garçom');

      await fillBaseFields(user);

      expect(screen.getByLabelText('Nome completo do responsável')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();

      await user.type(screen.getByLabelText('Nome completo do responsável'), 'José Souza');
      await user.type(screen.getByLabelText('CPF do responsável'), '11122283148');
      await user.type(screen.getByLabelText('Telefone do responsável'), '11988887777');
      expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();

      await user.click(screen.getByText(/autorizo esse cadastro/i));
      expect(screen.getByRole('button', { name: /continuar/i })).toBeEnabled();
    });

    it('envia os dados do responsável ao salvar', async () => {
      upsertWorkerProfileMock.mockResolvedValue({ fullName: 'Ana Souza', categoryIds: ['cat-1'], photoUrl: null });
      const user = userEvent.setup();
      render(<CadastroPage />);
      await screen.findByLabelText('Garçom');

      await fillBaseFields(user);
      await user.type(screen.getByLabelText('Nome completo do responsável'), 'José Souza');
      await user.type(screen.getByLabelText('CPF do responsável'), '11122283148');
      await user.type(screen.getByLabelText('Telefone do responsável'), '11988887777');
      await user.click(screen.getByText(/autorizo esse cadastro/i));
      await user.click(screen.getByRole('button', { name: /continuar/i }));

      await waitFor(() =>
        expect(upsertWorkerProfileMock).toHaveBeenCalledWith(
          expect.objectContaining({
            guardianFullName: 'José Souza',
            guardianCpf: '11122283148',
            guardianPhone: '11988887777',
            guardianAuthorized: true,
          }),
        ),
      );
    });
  });

  it('libera a URL do blob anterior ao trocar de foto, e a última ao desmontar', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<CadastroPage />);
    await screen.findByLabelText('Garçom');

    const input = screen.getByLabelText(/adicionar foto/i);
    await user.upload(input, new File(['foto1'], 'foto1.jpg', { type: 'image/jpeg' }));
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    await user.upload(input, new File(['foto2'], 'foto2.jpg', { type: 'image/jpeg' }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url-0');
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url-1');
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it('não tenta revogar a foto do Google (não é um blob local)', async () => {
    getCurrentUserMock.mockResolvedValue({
      user: { ...NO_GOOGLE_PHOTO_USER, googlePhotoUrl: 'https://lh3.googleusercontent.com/foto' },
    });
    const { unmount } = render(<CadastroPage />);
    await screen.findByText(/trocar foto/i);

    unmount();

    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('mostra o que falta preencher quando o formulário está incompleto', async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);
    await screen.findByLabelText('Garçom');

    expect(
      screen.getByText(/falta preencher:.*nome completo.*cpf.*telefone.*rua.*número.*categoria/i),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText('Nome completo'), 'Ana Souza');
    await user.type(screen.getByLabelText('CPF'), '52998224725');
    await user.type(screen.getByLabelText('Telefone'), '11912345678');
    await user.type(screen.getByLabelText('Rua'), 'Rua das Flores');
    await user.type(screen.getByLabelText('Número'), '123');
    fireEvent.change(screen.getByLabelText('Data de nascimento'), { target: { value: '2000-01-01' } });
    await user.click(screen.getByLabelText('Garçom'));

    // Foto de perfil é opcional — o formulário já fica válido sem ela.
    expect(screen.queryByText(/falta preencher/i)).not.toBeInTheDocument();
  });

  it('pré-seleciona a foto do Google quando disponível, sem forçar upload', async () => {
    getCurrentUserMock.mockResolvedValue({
      user: { ...NO_GOOGLE_PHOTO_USER, googlePhotoUrl: 'https://lh3.googleusercontent.com/foto' },
    });
    upsertWorkerProfileMock.mockResolvedValue({ fullName: 'Ana Souza', categoryIds: ['cat-1'], photoUrl: null });
    const user = userEvent.setup();
    render(<CadastroPage />);
    await screen.findByLabelText('Garçom');
    await screen.findByText(/trocar foto/i);

    await user.type(screen.getByLabelText('Nome completo'), 'Ana Souza');
    await user.type(screen.getByLabelText('CPF'), '52998224725');
    await user.type(screen.getByLabelText('Telefone'), '11912345678');
    await user.type(screen.getByLabelText('Rua'), 'Rua das Flores');
    await user.type(screen.getByLabelText('Número'), '123');
    fireEvent.change(screen.getByLabelText('Data de nascimento'), { target: { value: '2000-01-01' } });
    await user.click(screen.getByLabelText('Garçom'));
    expect(screen.getByRole('button', { name: /continuar/i })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/cadastro/documento'));
    expect(upsertWorkerProfileMock).toHaveBeenCalledWith({
      fullName: 'Ana Souza',
      categoryIds: ['cat-1'],
      photoUrl: 'https://lh3.googleusercontent.com/foto',
      cpf: '52998224725',
      phone: '11912345678',
      homeAddressFull: 'Rua das Flores, 123',

      birthDate: '2000-01-01',
      experienceByCategory: {},
    });
    expect(uploadWorkerPhotoMock).not.toHaveBeenCalled();
  });

  it('salva o perfil, envia a foto escolhida e navega pra tela de documento', async () => {
    upsertWorkerProfileMock.mockResolvedValue({ fullName: 'Ana Souza', categoryIds: ['cat-1'], photoUrl: null });
    uploadWorkerPhotoMock.mockResolvedValue({ photoUrl: '/uploads/public/foto.jpg' });
    const user = userEvent.setup();
    render(<CadastroPage />);
    await screen.findByLabelText('Garçom');

    await user.type(screen.getByLabelText('Nome completo'), 'Ana Souza');
    await user.type(screen.getByLabelText('CPF'), '52998224725');
    await user.type(screen.getByLabelText('Telefone'), '11912345678');
    await user.type(screen.getByLabelText('Rua'), 'Rua das Flores');
    await user.type(screen.getByLabelText('Número'), '123');
    fireEvent.change(screen.getByLabelText('Data de nascimento'), { target: { value: '2000-01-01' } });
    await user.click(screen.getByLabelText('Garçom'));
    const file = new File(['foto'], 'foto.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/adicionar foto/i), file);
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/cadastro/documento'));
    expect(upsertWorkerProfileMock).toHaveBeenCalledWith({
      fullName: 'Ana Souza',
      categoryIds: ['cat-1'],
      photoUrl: undefined,
      cpf: '52998224725',
      phone: '11912345678',
      homeAddressFull: 'Rua das Flores, 123',

      birthDate: '2000-01-01',
      experienceByCategory: {},
    });
    expect(uploadWorkerPhotoMock).toHaveBeenCalledWith(file);
  });

  it('mostra a mensagem da API quando salvar falha', async () => {
    upsertWorkerProfileMock.mockRejectedValue(new ApiError(400, 'Categoria inválida.'));
    const user = userEvent.setup();
    render(<CadastroPage />);
    await screen.findByLabelText('Garçom');

    await user.type(screen.getByLabelText('Nome completo'), 'Ana Souza');
    await user.type(screen.getByLabelText('CPF'), '52998224725');
    await user.type(screen.getByLabelText('Telefone'), '11912345678');
    await user.type(screen.getByLabelText('Rua'), 'Rua das Flores');
    await user.type(screen.getByLabelText('Número'), '123');
    fireEvent.change(screen.getByLabelText('Data de nascimento'), { target: { value: '2000-01-01' } });
    await user.click(screen.getByLabelText('Garçom'));
    const file = new File(['foto'], 'foto.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/adicionar foto/i), file);
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    expect(await screen.findByText('Categoria inválida.')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('ignora caracteres que não são número e aplica a máscara no CPF', async () => {
    const user = userEvent.setup();
    render(<CadastroPage />);
    await screen.findByLabelText('Garçom');

    await user.type(screen.getByLabelText('CPF'), 'abc52998224725xyz');

    expect(screen.getByLabelText('CPF')).toHaveValue('529.982.247-25');
  });

  it('envia a categoria de CNH escolhida', async () => {
    upsertWorkerProfileMock.mockResolvedValue({ fullName: 'Ana Souza', categoryIds: ['cat-1'], photoUrl: null });
    const user = userEvent.setup();
    render(<CadastroPage />);
    await screen.findByLabelText('Garçom');

    await user.type(screen.getByLabelText('Nome completo'), 'Ana Souza');
    await user.type(screen.getByLabelText('CPF'), '52998224725');
    await user.type(screen.getByLabelText('Telefone'), '11912345678');
    await user.type(screen.getByLabelText('Rua'), 'Rua das Flores');
    await user.type(screen.getByLabelText('Número'), '123');
    fireEvent.change(screen.getByLabelText('Data de nascimento'), { target: { value: '2000-01-01' } });
    await user.selectOptions(screen.getByLabelText(/categoria da cnh/i), 'B');
    await user.click(screen.getByLabelText('Garçom'));
    const file = new File(['foto'], 'foto.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/adicionar foto/i), file);
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() =>
      expect(upsertWorkerProfileMock).toHaveBeenCalledWith(expect.objectContaining({ cnhCategory: 'B' })),
    );
  });

  it('mostra o toggle de experiência só quando a categoria está marcada, e envia a escolha', async () => {
    upsertWorkerProfileMock.mockResolvedValue({ fullName: 'Ana Souza', categoryIds: ['cat-1'], photoUrl: null });
    const user = userEvent.setup();
    render(<CadastroPage />);
    await screen.findByLabelText('Garçom');

    expect(screen.queryByText(/já tem experiência como garçom/i)).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Garçom'));
    expect(await screen.findByText(/já tem experiência como garçom/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sim' }));

    await user.type(screen.getByLabelText('Nome completo'), 'Ana Souza');
    await user.type(screen.getByLabelText('CPF'), '52998224725');
    await user.type(screen.getByLabelText('Telefone'), '11912345678');
    await user.type(screen.getByLabelText('Rua'), 'Rua das Flores');
    await user.type(screen.getByLabelText('Número'), '123');
    fireEvent.change(screen.getByLabelText('Data de nascimento'), { target: { value: '2000-01-01' } });
    const file = new File(['foto'], 'foto.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/adicionar foto/i), file);
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() =>
      expect(upsertWorkerProfileMock).toHaveBeenCalledWith(
        expect.objectContaining({ experienceByCategory: { 'cat-1': true } }),
      ),
    );
  });

  it('cria uma categoria nova e já deixa ela marcada', async () => {
    createSkillCategoryMock.mockResolvedValue({ id: 'cat-new', name: 'Manobrista' });
    const user = userEvent.setup();
    render(<CadastroPage />);
    await screen.findByLabelText('Garçom');

    await user.click(screen.getByRole('button', { name: /criar nova categoria/i }));
    await user.type(screen.getByLabelText(/nome da nova categoria/i), 'Manobrista');
    await user.click(screen.getByRole('button', { name: /^adicionar$/i }));

    expect(await screen.findByLabelText('Manobrista')).toBeChecked();
    expect(createSkillCategoryMock).toHaveBeenCalledWith('Manobrista');
  });

  it('mostra erro quando criar categoria falha', async () => {
    createSkillCategoryMock.mockRejectedValue(new ApiError(400, 'Nome da categoria precisa ter entre 2 e 100 caracteres.'));
    const user = userEvent.setup();
    render(<CadastroPage />);
    await screen.findByLabelText('Garçom');

    await user.click(screen.getByRole('button', { name: /criar nova categoria/i }));
    await user.type(screen.getByLabelText(/nome da nova categoria/i), 'ok');
    await user.click(screen.getByRole('button', { name: /^adicionar$/i }));

    expect(
      await screen.findByText('Nome da categoria precisa ter entre 2 e 100 caracteres.'),
    ).toBeInTheDocument();
  });
});
