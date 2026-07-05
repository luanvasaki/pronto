'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { ApiError, listSkillCategories, SkillCategory } from '@shift/shared';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Logo } from '../../components/ui/logo';
import { upsertWorkerProfile } from '../../lib/worker-profile-api';

export default function CadastroPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSkillCategories()
      .then((data) => setCategories(data.categories))
      .catch(() => setError('Não foi possível carregar as categorias.'))
      .finally(() => setIsLoadingCategories(false));
  }, []);

  function toggleCategory(id: string): void {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  const isValid = fullName.trim().length >= 2 && selectedIds.length > 0;

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isValid || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await upsertWorkerProfile(fullName, selectedIds);
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
