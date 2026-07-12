'use client';

import { ApiError, CNH_CATEGORY_OPTIONS, listSkillCategories, SkillCategory } from '@shift/shared';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Button } from '../../../../../components/ui/button';
import { Input } from '../../../../../components/ui/input';
import { getCurrentPosition } from '../../../../../lib/geolocation';
import { listMyJobs, updateJob } from '../../../../../lib/jobs-api';

const PAY_AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;

/**
 * `job.startsAt`/`endsAt` chegam em UTC (ISO com "Z") — um `<input
 * type="datetime-local">` espera o horário LOCAL, sem timezone. Só
 * cortar a string (`.slice(0, 16)`) mostraria o relógio de UTC como
 * se fosse local: certo só por coincidência pra quem está em UTC+0,
 * errado (por até várias horas) pra qualquer empresa no Brasil — e ao
 * salvar sem mexer nesse campo, o horário da vaga mudaria sozinho.
 */
function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
}

export default function EditarVagaPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const jobId = params.id;

  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState('');
  const [requiresExperience, setRequiresExperience] = useState<boolean | null>(null);
  const [dressCode, setDressCode] = useState('');
  const [toolsRequired, setToolsRequired] = useState('');
  const [cnhCategory, setCnhCategory] = useState('');
  const [cnhRequired, setCnhRequired] = useState(false);
  const [offersMeal, setOffersMeal] = useState(false);
  const [offersTransport, setOffersTransport] = useState(false);
  const [description, setDescription] = useState('');
  const [addressLabel, setAddressLabel] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [positionsTotal, setPositionsTotal] = useState('1');
  const [payAmount, setPayAmount] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  // Vazio = fecha automaticamente 1h antes do início (padrão do backend).
  const [applicationsCloseAt, setApplicationsCloseAt] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationJustUpdated, setLocationJustUpdated] = useState(false);

  async function handleUseCurrentLocation(): Promise<void> {
    setLocationError(null);
    setIsLocating(true);
    try {
      const position = await getCurrentPosition();
      setLat(position.coords.latitude);
      setLng(position.coords.longitude);
      setLocationJustUpdated(true);
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : 'Não foi possível obter sua localização.');
    } finally {
      setIsLocating(false);
    }
  }

  useEffect(() => {
    Promise.all([listMyJobs(), listSkillCategories()])
      .then(([jobsResult, categoriesResult]) => {
        setCategories(categoriesResult.categories);

        const job = jobsResult.jobs.find((candidate) => candidate.id === jobId);
        if (!job) {
          setLoadError('Vaga não encontrada.');
          return;
        }
        if (job.status !== 'open') {
          setLoadError('Só é possível editar vagas abertas.');
          return;
        }

        setCategoryId(job.categoryId);
        setRequiresExperience(job.requiresExperience);
        setDressCode(job.dressCode ?? '');
        setToolsRequired(job.toolsRequired ?? '');
        setCnhCategory(job.cnhCategory ?? '');
        setCnhRequired(job.cnhRequired);
        setOffersMeal(job.offersMeal);
        setOffersTransport(job.offersTransport);
        setDescription(job.description);
        setAddressLabel(job.addressLabel);
        setLat(job.locationLat);
        setLng(job.locationLng);
        setPositionsTotal(String(job.positionsTotal));
        setPayAmount(job.payAmount);
        setStartsAt(toDateTimeLocal(job.startsAt));
        setEndsAt(toDateTimeLocal(job.endsAt));
        setApplicationsCloseAt(job.applicationsCloseAt ? toDateTimeLocal(job.applicationsCloseAt) : '');
      })
      .catch(() => setLoadError('Não foi possível carregar a vaga.'))
      .finally(() => setIsLoading(false));
  }, [jobId]);

  const positionsTotalNumber = Number(positionsTotal);
  const payAmountNumber = Number(payAmount);
  const showEstimate =
    Number.isInteger(positionsTotalNumber) &&
    positionsTotalNumber >= 1 &&
    PAY_AMOUNT_REGEX.test(payAmount) &&
    payAmountNumber > 0;
  const estimateTotal = positionsTotalNumber * payAmountNumber;
  // Mesmo motivo de vagas/nova: sem isso o botão "Salvar" fica cinza sem
  // nenhuma pista de qual campo falta (localização é a mais fácil de
  // esquecer, já que fica num botão separado do campo de endereço).
  const missingFields: string[] = [];
  if (categoryId === '') missingFields.push('categoria');
  if (requiresExperience === null) missingFields.push('exigência de experiência');
  if (description.trim().length < 10) missingFields.push('descrição');
  if (addressLabel.trim().length < 2) missingFields.push('endereço');
  if (lat === null || lng === null) missingFields.push('localização (clique em "Usar minha localização atual")');
  if (!Number.isInteger(positionsTotalNumber) || positionsTotalNumber < 1) missingFields.push('número de vagas');
  if (!PAY_AMOUNT_REGEX.test(payAmount) || Number(payAmount) <= 0) missingFields.push('valor por pessoa');
  if (startsAt === '') missingFields.push('início');
  if (endsAt === '') missingFields.push('término');
  if (startsAt !== '' && endsAt !== '' && !(new Date(endsAt) > new Date(startsAt))) {
    missingFields.push('término depois do início');
  }
  if (startsAt !== '' && !(new Date(startsAt) > new Date())) missingFields.push('início no futuro');
  if (applicationsCloseAt !== '' && startsAt !== '' && new Date(applicationsCloseAt) > new Date(startsAt)) {
    missingFields.push('prazo de candidatura até o início');
  }

  const isValid = missingFields.length === 0;

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isValid || isSubmitting || lat === null || lng === null || requiresExperience === null) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await updateJob(jobId, {
        categoryId,
        description,
        requiresExperience,
        dressCode: dressCode.trim() || undefined,
        toolsRequired: toolsRequired.trim() || undefined,
        cnhCategory: cnhCategory || undefined,
        cnhRequired,
        offersMeal,
        offersTransport,
        addressLabel,
        locationLat: lat,
        locationLng: lng,
        positionsTotal: positionsTotalNumber,
        payAmount,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        applicationsCloseAt: applicationsCloseAt ? new Date(applicationsCloseAt).toISOString() : undefined,
      });
      router.push('/painel');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a vaga.');
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Carregando a vaga...</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 text-center">
        <p className="text-sm text-danger">{loadError}</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-8">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-5">
        <p className="text-[15px] text-text-secondary">Corrija os detalhes da escala.</p>

        <div>
          <label htmlFor="categoryId" className="mb-1.5 block text-sm font-medium text-text-secondary">
            Categoria
          </label>
          <select
            id="categoryId"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-text transition focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
          >
            <option value="">Selecione uma categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
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

          <div>
            <label htmlFor="cnhCategory" className="mb-1.5 block text-sm font-medium text-text-secondary">
              Exige CNH? (opcional)
            </label>
            <select
              id="cnhCategory"
              value={cnhCategory}
              onChange={(event) => setCnhCategory(event.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-text transition focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
            >
              <option value="">Nenhuma exigência</option>
              {CNH_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {cnhCategory && (
              <div className="mt-2.5">
                <span className="mb-1.5 block text-sm font-medium text-text-secondary">
                  Isso é obrigatório pra se candidatar ou só uma preferência?
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCnhRequired(true)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition ${
                      cnhRequired
                        ? 'border-primary bg-primary text-white'
                        : 'border-border bg-surface text-text-secondary'
                    }`}
                  >
                    Obrigatório
                  </button>
                  <button
                    type="button"
                    onClick={() => setCnhRequired(false)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition ${
                      !cnhRequired
                        ? 'border-primary bg-primary text-white'
                        : 'border-border bg-surface text-text-secondary'
                    }`}
                  >
                    Preferência
                  </button>
                </div>
                {cnhRequired && (
                  <p className="mt-1.5 text-xs text-text-secondary">
                    Quem não tiver CNH {cnhCategory} não vai conseguir se candidatar.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
          <p className="font-heading text-sm font-bold text-text">Benefícios oferecidos</p>
          <label className="flex items-center gap-2 text-sm font-medium text-text">
            <input
              type="checkbox"
              checked={offersMeal}
              onChange={(event) => setOffersMeal(event.target.checked)}
            />
            Oferece alimentação
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-text">
            <input
              type="checkbox"
              checked={offersTransport}
              onChange={(event) => setOffersTransport(event.target.checked)}
            />
            Oferece transporte
          </label>
        </div>

        <div>
          <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-text-secondary">
            Descrição
          </label>
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-text transition focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
          />
        </div>

        <div>
          <Input
            id="addressLabel"
            label="Endereço completo"
            type="text"
            placeholder="Rua Augusta, 1200 - Consolação, São Paulo"
            value={addressLabel}
            onChange={(event) => setAddressLabel(event.target.value)}
          />
          <p className="mt-1.5 text-xs text-text-secondary">
            Inclua rua, número e bairro — é o endereço que o trabalhador vai usar pra chegar até você.
          </p>
        </div>

        <div>
          <Button type="button" variant="outlined" onClick={handleUseCurrentLocation} isLoading={isLocating}>
            {locationJustUpdated ? 'Localização atualizada ✓' : 'Usar minha localização atual'}
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

        <div>
          <Input
            id="applicationsCloseAt"
            label="Fechar candidaturas em (opcional)"
            type="datetime-local"
            value={applicationsCloseAt}
            onChange={(event) => setApplicationsCloseAt(event.target.value)}
          />
          <p className="mt-1.5 text-xs text-text-secondary">
            Depois desse horário a vaga some da busca dos profissionais. Se não escolher, fecha
            automaticamente 1h antes do início.
          </p>
          {applicationsCloseAt !== '' && startsAt !== '' && new Date(applicationsCloseAt) > new Date(startsAt) && (
            <p className="mt-1.5 text-xs text-danger">Precisa ser até o horário de início da escala.</p>
          )}
        </div>

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

        {!isValid && <p className="text-xs text-danger">Falta preencher: {missingFields.join(', ')}.</p>}

        <Button type="submit" disabled={!isValid} isLoading={isSubmitting}>
          Salvar alterações
        </Button>
      </form>
    </main>
  );
}
