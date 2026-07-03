'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ApiError } from '../../lib/api';
import {
  listSkillCategories,
  SkillCategory,
  upsertWorkerProfile,
} from '../../lib/worker-profile-api';

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
            <div className="flex flex-col gap-2">
              {categories.map((category) => (
                <label
                  key={category.id}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(category.id)}
                    onChange={() => toggleCategory(category.id)}
                    className="h-4 w-4 accent-primary"
                  />
                  {category.name}
                </label>
              ))}
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
