'use client';

import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import {
  ApiError,
  CNH_CATEGORY_OPTIONS,
  createSkillCategory,
  extractDigits,
  formatCpf,
  formatPhone,
  getCurrentUser,
  isValidCpf,
  listSkillCategories,
  SkillCategory,
} from '@shift/shared';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Logo } from '../../components/ui/logo';
import { upsertWorkerProfile, uploadWorkerPhoto } from '../../lib/worker-profile-api';

// Mesmos valores do backend (ver upsertWorkerProfile) — evita mandar o
// formulário só pra levar 400 de volta.
const MIN_WORKER_AGE_YEARS = 16;
const ADULT_AGE_YEARS = 18;

/** Mesmo cálculo do backend (ver upsertWorkerProfile) — evita mandar o formulário só pra levar 400 de volta. */
function calculateAge(birthDate: string, now: Date): number {
  const [year, month, day] = birthDate.split('-').map(Number);
  let age = now.getFullYear() - year;
  const hasHadBirthdayThisYear = now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day);
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export default function CadastroPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [homeAddressFull, setHomeAddressFull] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [cnhCategory, setCnhCategory] = useState('');
  const [guardianFullName, setGuardianFullName] = useState('');
  const [guardianCpf, setGuardianCpf] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianAuthorized, setGuardianAuthorized] = useState(false);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [googlePhotoUrl, setGooglePhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [experienceByCategory, setExperienceByCategory] = useState<Record<string, boolean>>({});
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [createCategoryError, setCreateCategoryError] = useState<string | null>(null);

  useEffect(() => {
    listSkillCategories()
      .then((data) => setCategories(data.categories))
      .catch(() => setError('Não foi possível carregar as categorias.'))
      .finally(() => setIsLoadingCategories(false));

    getCurrentUser()
      .then(({ user }) => {
        if (user.googlePhotoUrl) {
          setGooglePhotoUrl(user.googlePhotoUrl);
          setPhotoPreviewUrl(user.googlePhotoUrl);
        }
      })
      .catch(() => undefined);
  }, []);

  function toggleCategory(id: string): void {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function setCategoryExperience(id: string, hasExperience: boolean): void {
    setExperienceByCategory((current) => ({ ...current, [id]: hasExperience }));
  }

  async function handleCreateCategory(): Promise<void> {
    const trimmedName = newCategoryName.trim();
    if (trimmedName.length < 2 || isCreatingCategory) return;

    setCreateCategoryError(null);
    setIsCreatingCategory(true);
    try {
      const category = await createSkillCategory(trimmedName);
      setCategories((current) =>
        current.some((existing) => existing.id === category.id) ? current : [...current, category],
      );
      setSelectedIds((current) => (current.includes(category.id) ? current : [...current, category.id]));
      setNewCategoryName('');
      setIsAddingCategory(false);
    } catch (err) {
      setCreateCategoryError(err instanceof ApiError ? err.message : 'Não foi possível criar a categoria.');
    } finally {
      setIsCreatingCategory(false);
    }
  }

  /**
   * `photoPreviewUrl` também guarda a foto do Google (URL de verdade, não
   * criada por nós) quando não há `photoFile` — só revoga o blob local, e só
   * quando ele deixa de estar em uso (troca de foto ou saída da tela), pra
   * não vazar memória a cada nova seleção.
   */
  useEffect(() => {
    if (!photoFile || !photoPreviewUrl) return;
    return () => URL.revokeObjectURL(photoPreviewUrl);
  }, [photoFile, photoPreviewUrl]);

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  }

  const isMinor = birthDate.length > 0 && calculateAge(birthDate, new Date()) < ADULT_AGE_YEARS;

  const missingFields: string[] = [];
  if (fullName.trim().length < 2) missingFields.push('nome completo');
  if (!isValidCpf(cpf)) missingFields.push('CPF');
  if (phone.length < 10 || phone.length > 11) missingFields.push('telefone');
  if (homeAddressFull.trim().length < 8) missingFields.push('endereço completo');
  if (!birthDate) missingFields.push('data de nascimento');
  if (selectedIds.length === 0) missingFields.push('ao menos uma categoria');
  const isUnderage = birthDate.length > 0 && calculateAge(birthDate, new Date()) < MIN_WORKER_AGE_YEARS;
  // Só pede os campos do responsável quando o formulário do responsável
  // realmente aparece na tela (isMinor && !isUnderage, ver JSX abaixo)
  // — abaixo de 16 anos o cadastro já é bloqueado por outro motivo, e
  // listar "nome do responsável" faltando ali só confundiria quem nem
  // vê esse formulário.
  if (isMinor && !isUnderage) {
    if (guardianFullName.trim().length < 2) missingFields.push('nome do responsável');
    if (!isValidCpf(guardianCpf)) missingFields.push('CPF do responsável');
    if (guardianPhone.length < 10 || guardianPhone.length > 11) missingFields.push('telefone do responsável');
    if (!guardianAuthorized) missingFields.push('autorização do responsável');
  }
  const isValid = missingFields.length === 0 && !isUnderage;

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isValid || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const useGooglePhoto = !photoFile && photoPreviewUrl === googlePhotoUrl;
      await upsertWorkerProfile({
        fullName,
        categoryIds: selectedIds,
        photoUrl: useGooglePhoto ? googlePhotoUrl! : undefined,
        cpf,
        phone,
        homeAddressFull: homeAddressFull.trim(),
        birthDate,
        cnhCategory: cnhCategory || undefined,
        experienceByCategory,
        guardianFullName: isMinor ? guardianFullName.trim() : undefined,
        guardianCpf: isMinor ? guardianCpf : undefined,
        guardianPhone: isMinor ? guardianPhone : undefined,
        guardianAuthorized: isMinor ? guardianAuthorized : undefined,
      });
      if (photoFile) {
        await uploadWorkerPhoto(photoFile);
      }
      router.push('/cadastro/documento');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar seu cadastro.');
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-8">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-5">
        <Logo className="mb-2" />
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Complete seu cadastro</h1>
          <p className="mt-1 text-[15px] text-text-secondary">
            Nome e categoria de trabalho — o resto você ajusta depois.
          </p>
        </div>

        <Input
          id="fullName"
          label="Nome completo"
          type="text"
          autoComplete="name"
          placeholder="Seu nome"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />

        <Input
          id="cpf"
          label="CPF"
          type="text"
          inputMode="numeric"
          placeholder="000.000.000-00"
          maxLength={14}
          value={formatCpf(cpf)}
          onChange={(event) => setCpf(extractDigits(event.target.value).slice(0, 11))}
        />

        <div>
          <Input
            id="phone"
            label="Telefone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="(11) 91234-5678"
            maxLength={16}
            value={formatPhone(phone)}
            onChange={(event) => setPhone(extractDigits(event.target.value).slice(0, 11))}
          />
          <p className="mt-1.5 text-xs text-text-secondary">
            Protegido — só o admin vê, pra entrar em contato se precisar. Empresas nunca veem.
          </p>
        </div>

        <div>
          <Input
            id="homeAddressFull"
            label="Endereço completo"
            type="text"
            placeholder="Rua, número, bairro, cidade - UF"
            value={homeAddressFull}
            onChange={(event) => setHomeAddressFull(event.target.value)}
          />
          <p className="mt-1.5 text-xs text-text-secondary">
            Só pra confirmar sua identidade — protegido, empresas nunca veem esse endereço.
          </p>
        </div>

        <div>
          <Input
            id="birthDate"
            label="Data de nascimento"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
          />
          {isUnderage ? (
            <p className="mt-1.5 text-xs text-danger">
              É preciso ter 16 anos ou mais pra se cadastrar como trabalhador no Pronto.
            </p>
          ) : isMinor ? (
            <p className="mt-1.5 text-xs text-text-secondary">
              Como você tem menos de 18 anos, também vamos pedir os dados do seu responsável logo abaixo — nunca
              aparece pra empresas.
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-text-secondary">
              Só pra confirmar que você tem 16 anos ou mais — nunca aparece pra empresas.
            </p>
          )}
        </div>

        {isMinor && !isUnderage && (
          <div className="flex flex-col gap-4 rounded-[18px] border border-border bg-surface p-4">
            <div>
              <h2 className="font-heading text-base font-bold text-text">Dados do responsável</h2>
              <p className="mt-1 text-xs text-text-secondary">
                Como você é menor de idade, precisamos dos dados de quem autoriza seu trabalho — protegido, empresas
                nunca veem.
              </p>
            </div>

            <Input
              id="guardianFullName"
              label="Nome completo do responsável"
              type="text"
              autoComplete="off"
              placeholder="Nome do pai, mãe ou responsável legal"
              value={guardianFullName}
              onChange={(event) => setGuardianFullName(event.target.value)}
            />

            <Input
              id="guardianCpf"
              label="CPF do responsável"
              type="text"
              inputMode="numeric"
              placeholder="000.000.000-00"
              maxLength={14}
              value={formatCpf(guardianCpf)}
              onChange={(event) => setGuardianCpf(extractDigits(event.target.value).slice(0, 11))}
            />

            <Input
              id="guardianPhone"
              label="Telefone do responsável"
              type="tel"
              inputMode="numeric"
              placeholder="(11) 91234-5678"
              maxLength={16}
              value={formatPhone(guardianPhone)}
              onChange={(event) => setGuardianPhone(extractDigits(event.target.value).slice(0, 11))}
            />

            <label className="flex items-start gap-2 text-[12.5px] text-text-secondary">
              <input
                type="checkbox"
                checked={guardianAuthorized}
                onChange={() => setGuardianAuthorized((current) => !current)}
                className="mt-0.5 shrink-0"
              />
              Eu, na condição de responsável legal, autorizo esse cadastro e o trabalho do menor no Pronto.
            </label>
          </div>
        )}

        <div>
          <label htmlFor="cnhCategory" className="mb-1.5 block text-sm font-medium text-text-secondary">
            Categoria da CNH (opcional)
          </label>
          <select
            id="cnhCategory"
            value={cnhCategory}
            onChange={(event) => setCnhCategory(event.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-text transition focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
          >
            <option value="">Não tenho CNH</option>
            {CNH_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-text-secondary">
            Algumas vagas exigem uma categoria de CNH pra se candidatar.
          </p>
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-text-secondary">Foto de perfil (opcional)</span>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-border bg-surface">
              {photoPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreviewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-text-secondary">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M4 20c0-4 3.6-6 8-6s8 2 8 6M12 12a4 4 0 100-8 4 4 0 000 8z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>
            <label className="cursor-pointer text-sm font-semibold text-primary underline underline-offset-2">
              {photoFile || googlePhotoUrl ? 'Trocar foto' : 'Adicionar foto'}
              <input type="file" accept="image/jpeg,image/png" onChange={handlePhotoChange} className="sr-only" />
            </label>
          </div>
          <p className="mt-1.5 text-xs text-text-secondary">
            Empresas veem essa foto ao avaliar sua candidatura — perfis com foto passam mais confiança.
          </p>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-text-secondary">
            Categoria (escolha uma ou mais)
          </legend>
          {isLoadingCategories ? (
            <p className="text-sm text-text-secondary">Carregando categorias...</p>
          ) : (
            <div className="flex flex-col gap-3">
              {categories.map((category) => {
                const selected = selectedIds.includes(category.id);
                const hasExperience = experienceByCategory[category.id] ?? false;
                return (
                  <div
                    key={category.id}
                    className={`rounded-[18px] border p-4 transition ${
                      selected
                        ? 'border-2 border-primary bg-surface shadow-[0_8px_20px_rgba(245,83,30,0.1)]'
                        : 'border-[1.5px] border-border bg-surface'
                    }`}
                  >
                    <label className="flex cursor-pointer items-center gap-3.5">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleCategory(category.id)}
                        className="sr-only"
                      />
                      <span className="flex-1 font-heading text-[17px] font-bold text-text">
                        {category.name}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ${
                          selected ? 'bg-primary' : 'border-2 border-border'
                        }`}
                      >
                        {selected && (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M5 13l4 4L19 7"
                              stroke="#fff"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                    </label>

                    {selected && (
                      <div className="mt-3.5 border-t border-border pt-3.5">
                        <span className="mb-1.5 block text-sm font-medium text-text-secondary">
                          Já tem experiência como {category.name.toLowerCase()}?
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setCategoryExperience(category.id, true)}
                            className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition ${
                              hasExperience
                                ? 'border-primary bg-primary text-white'
                                : 'border-border bg-surface text-text-secondary'
                            }`}
                          >
                            Sim
                          </button>
                          <button
                            type="button"
                            onClick={() => setCategoryExperience(category.id, false)}
                            className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition ${
                              !hasExperience
                                ? 'border-primary bg-primary text-white'
                                : 'border-border bg-surface text-text-secondary'
                            }`}
                          >
                            Não
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {isAddingCategory ? (
            <div className="mt-3 flex flex-col gap-2 rounded-[18px] border border-dashed border-border p-4">
              <Input
                id="newCategoryName"
                label="Nome da nova categoria"
                type="text"
                placeholder="Manobrista, Recepcionista..."
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
              />
              <p className="text-xs text-text-secondary">
                Já pode usar essa categoria agora — o admin revisa o nome depois.
              </p>
              {createCategoryError && <p className="text-sm text-danger">{createCategoryError}</p>}
              <div className="flex gap-2">
                <Button
                  type="button"
                  isLoading={isCreatingCategory}
                  disabled={newCategoryName.trim().length < 2}
                  onClick={handleCreateCategory}
                >
                  Adicionar
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingCategory(false);
                    setNewCategoryName('');
                    setCreateCategoryError(null);
                  }}
                  className="text-sm text-text-secondary underline underline-offset-2"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingCategory(true)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-border p-4 text-sm font-semibold text-text-secondary transition hover:text-text"
            >
              + Criar nova categoria
            </button>
          )}
        </fieldset>

        {error && <p className="text-sm text-danger">{error}</p>}

        {!isValid && (
          <p className="text-xs text-danger">Falta preencher: {missingFields.join(', ')}.</p>
        )}

        <Button type="submit" disabled={!isValid} isLoading={isSubmitting}>
          Continuar
        </Button>
      </form>
    </main>
  );
}
