'use client';

import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { ApiError, getCurrentUser, listSkillCategories, SkillCategory } from '@shift/shared';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Logo } from '../../components/ui/logo';
import { upsertWorkerProfile, uploadWorkerPhoto } from '../../lib/worker-profile-api';

export default function CadastroPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [googlePhotoUrl, setGooglePhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  }

  const isValid = fullName.trim().length >= 2 && selectedIds.length > 0 && Boolean(photoPreviewUrl);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isValid || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const useGooglePhoto = !photoFile && photoPreviewUrl === googlePhotoUrl;
      await upsertWorkerProfile(fullName, selectedIds, useGooglePhoto ? googlePhotoUrl! : undefined);
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

        <div>
          <span className="mb-2 block text-sm font-medium text-text-secondary">Foto de perfil</span>
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
                return (
                  <label
                    key={category.id}
                    className={`flex cursor-pointer items-center gap-3.5 rounded-[18px] border p-4 transition ${
                      selected
                        ? 'border-2 border-primary bg-surface shadow-[0_8px_20px_rgba(245,83,30,0.1)]'
                        : 'border-[1.5px] border-border bg-surface'
                    }`}
                  >
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
                );
              })}
            </div>
          )}
        </fieldset>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={!isValid} isLoading={isSubmitting}>
          Continuar
        </Button>
      </form>
    </main>
  );
}
