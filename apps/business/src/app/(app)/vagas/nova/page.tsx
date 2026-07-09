'use client';

import { ApiError, createSkillCategory, listSkillCategories, SkillCategory } from '@shift/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { getCurrentPosition } from '../../../../lib/geolocation';
import { createJob } from '../../../../lib/jobs-api';

const PAY_AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;
const NEW_CATEGORY_OPTION = '__new__';

/** yyyy-mm-dd (formato do <input type="date"> e do que a Escala manda na URL) — recusa qualquer outra coisa. */
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export default function NovaVagaPage() {
  return (
    <Suspense fallback={null}>
      <NovaVagaForm />
    </Suspense>
  );
}

function NovaVagaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  const [categoryId, setCategoryId] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [requiresExperience, setRequiresExperience] = useState<boolean | null>(null);
  const [dressCode, setDressCode] = useState('');
  const [toolsRequired, setToolsRequired] = useState('');
  const [description, setDescription] = useState('');
  const [addressLabel, setAddressLabel] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [positionsTotal, setPositionsTotal] = useState('1');
  const [payAmount, setPayAmount] = useState('');
  // Vindo da Escala (clicou num dia do calendário) — pré-preenche a
  // data com um horário comum de turno; a pessoa ainda ajusta a hora.
  const prefilledDate = searchParams.get('data');
  const [startsAt, setStartsAt] = useState(
    prefilledDate && DATE_ONLY_REGEX.test(prefilledDate) ? `${prefilledDate}T18:00` : '',
  );
  const [endsAt, setEndsAt] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSkillCategories()
      .then((data) => setCategories(data.categories))
      .catch(() => setError('Não foi possível carregar as categorias.'))
      .finally(() => setIsLoadingCategories(false));
  }, []);

  async function handleUseCurrentLocation(): Promise<void> {
    setLocationError(null);
    setIsLocating(true);
    try {
      const position = await getCurrentPosition();
      setLat(position.coords.latitude);
      setLng(position.coords.longitude);
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : 'Não foi possível obter sua localização.');
    } finally {
      setIsLocating(false);
    }
  }

  const positionsTotalNumber = Number(positionsTotal);
  const payAmountNumber = Number(payAmount);
  const showEstimate =
    Number.isInteger(positionsTotalNumber) &&
    positionsTotalNumber >= 1 &&
    PAY_AMOUNT_REGEX.test(payAmount) &&
    payAmountNumber > 0;
  const estimateTotal = positionsTotalNumber * payAmountNumber;
  const isNewCategory = categoryId === NEW_CATEGORY_OPTION;
  const isValid =
    categoryId !== '' &&
    (!isNewCategory || newCategoryName.trim().length >= 2) &&
    requiresExperience !== null &&
    description.trim().length >= 10 &&
    addressLabel.trim().length >= 2 &&
    lat !== null &&
    lng !== null &&
    Number.isInteger(positionsTotalNumber) &&
    positionsTotalNumber >= 1 &&
    PAY_AMOUNT_REGEX.test(payAmount) &&
    Number(payAmount) > 0 &&
    startsAt !== '' &&
    endsAt !== '' &&
    new Date(endsAt) > new Date(startsAt) &&
    new Date(startsAt) > new Date();

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isValid || isSubmitting || lat === null || lng === null || requiresExperience === null) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const resolvedCategoryId = isNewCategory
        ? (await createSkillCategory(newCategoryName.trim())).id
        : categoryId;

      await createJob({
        categoryId: resolvedCategoryId,
        description,
        requiresExperience,
        dressCode: dressCode.trim() || undefined,
        toolsRequired: toolsRequired.trim() || undefined,
        addressLabel,
        locationLat: lat,
        locationLng: lng,
        positionsTotal: positionsTotalNumber,
        payAmount,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      });
      router.push('/painel');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível publicar a vaga.');
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-8">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-5">
        <p className="text-[15px] text-text-secondary">
          Preencha os detalhes do turno que você precisa cobrir.
        </p>

        <div>
          <label htmlFor="categoryId" className="mb-1.5 block text-sm font-medium text-text-secondary">
            Categoria
          </label>
          <select
            id="categoryId"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            disabled={isLoadingCategories}
            className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-text transition focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
          >
            <option value="">
              {isLoadingCategories ? 'Carregando categorias...' : 'Selecione uma categoria'}
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
            <option value={NEW_CATEGORY_OPTION}>+ Criar nova categoria</option>
          </select>
          {isNewCategory && (
            <div className="mt-2.5">
              <Input
                id="newCategoryName"
                label="Nome da nova categoria"
                type="text"
                placeholder="Manobrista, Recepcionista..."
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
              />
              <p className="mt-1.5 text-xs text-text-secondary">
                Já pode usar essa vaga assim que publicar — o admin revisa o nome da categoria depois.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
          <p className="font-heading text-sm font-bold text-text">O que essa vaga exige?</p>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-text-secondary">
              Precisa de experiência anterior?
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRequiresExperience(true)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition ${
                  requiresExperience === true
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-surface text-text-secondary'
                }`}
              >
                Sim
              </button>
              <button
                type="button"
                onClick={() => setRequiresExperience(false)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition ${
                  requiresExperience === false
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-surface text-text-secondary'
                }`}
              >
                Não
              </button>
            </div>
          </div>

          <Input
            id="dressCode"
            label="Vestimenta exigida (opcional)"
            type="text"
            placeholder="Social, uniforme fornecido, traje esportivo..."
            value={dressCode}
            onChange={(event) => setDressCode(event.target.value)}
          />

          <Input
            id="toolsRequired"
            label="Ferramentas que o profissional precisa levar (opcional)"
            type="text"
            placeholder="Câmera própria, ferramentas de bar..."
            value={toolsRequired}
            onChange={(event) => setToolsRequired(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-text-secondary">
            Descrição
          </label>
          <textarea
            id="description"
            rows={3}
            placeholder="Outros detalhes que o profissional precisa saber..."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-text transition focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
          />
        </div>

        <Input
          id="addressLabel"
          label="Endereço"
          type="text"
          placeholder="Vila Madalena, São Paulo"
          value={addressLabel}
          onChange={(event) => setAddressLabel(event.target.value)}
        />

        <div>
          <Button type="button" variant="outlined" onClick={handleUseCurrentLocation} isLoading={isLocating}>
            {lat !== null && lng !== null ? 'Localização definida ✓' : 'Usar minha localização atual'}
          </Button>
          {locationError && <p className="mt-1.5 text-sm text-danger">{locationError}</p>}
        </div>

        <Input
          id="positionsTotal"
          label="Número de vagas"
          type="number"
          min={1}
          value={positionsTotal}
          onChange={(event) => setPositionsTotal(event.target.value)}
        />

        <Input
          id="payAmount"
          label="Valor por pessoa (R$)"
          type="text"
          inputMode="decimal"
          placeholder="130.00"
          value={payAmount}
          onChange={(event) => setPayAmount(event.target.value)}
        />

        <Input
          id="startsAt"
          label="Início"
          type="datetime-local"
          value={startsAt}
          onChange={(event) => setStartsAt(event.target.value)}
        />

        <Input
          id="endsAt"
          label="Término"
          type="datetime-local"
          value={endsAt}
          onChange={(event) => setEndsAt(event.target.value)}
        />

        {showEstimate && (
          <div className="rounded-2xl bg-secondary p-4 text-background">
            <p className="text-xs tracking-wide text-text-secondary uppercase">
              Estimativa · {positionsTotalNumber} vaga(s)
            </p>
            <div className="mt-3 flex items-center justify-between">
              <span className="font-heading text-base font-bold">Total estimado</span>
              <span className="font-heading text-2xl font-extrabold text-primary">
                R$ {estimateTotal.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={!isValid} isLoading={isSubmitting}>
          Publicar
        </Button>
      </form>
    </main>
  );
}
