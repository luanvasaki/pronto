'use client';

import { ApiError, listSkillCategories, SkillCategory } from '@shift/shared';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { useRequireAuth } from '../../../../hooks/use-require-auth';
import { listMyJobs, updateJob } from '../../../../lib/jobs-api';

const PAY_AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;

function toDateTimeLocal(value: string): string {
  return value.slice(0, 16);
}

export default function EditarVagaPage() {
  const { isChecking } = useRequireAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const jobId = params.id;

  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [addressLabel, setAddressLabel] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [positionsTotal, setPositionsTotal] = useState('1');
  const [payAmount, setPayAmount] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationJustUpdated, setLocationJustUpdated] = useState(false);

  function handleUseCurrentLocation(): void {
    if (!navigator.geolocation) {
      setLocationError('Geolocalização não é suportada nesse navegador.');
      return;
    }

    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude);
        setLng(position.coords.longitude);
        setLocationJustUpdated(true);
      },
      () => setLocationError('Não foi possível obter sua localização.'),
    );
  }

  useEffect(() => {
    if (isChecking) return;

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
        setDescription(job.description);
        setAddressLabel(job.addressLabel);
        setLat(job.locationLat);
        setLng(job.locationLng);
        setPositionsTotal(String(job.positionsTotal));
        setPayAmount(job.payAmount);
        setStartsAt(toDateTimeLocal(job.startsAt));
        setEndsAt(toDateTimeLocal(job.endsAt));
      })
      .catch(() => setLoadError('Não foi possível carregar a vaga.'))
      .finally(() => setIsLoading(false));
  }, [isChecking, jobId]);

  const positionsTotalNumber = Number(positionsTotal);
  const isValid =
    categoryId !== '' &&
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
    if (!isValid || isSubmitting || lat === null || lng === null) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await updateJob(jobId, {
        categoryId,
        description,
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
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a vaga.');
      setIsSubmitting(false);
    }
  }

  if (isChecking || isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">
          {isChecking ? 'Confirmando sua sessão...' : 'Carregando a vaga...'}
        </p>
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
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Editar vaga</h1>
          <p className="mt-1 text-[15px] text-text-secondary">Corrija os detalhes do turno.</p>
        </div>

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

        <Input
          id="addressLabel"
          label="Endereço"
          type="text"
          value={addressLabel}
          onChange={(event) => setAddressLabel(event.target.value)}
        />

        <div>
          <Button type="button" variant="outlined" onClick={handleUseCurrentLocation}>
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

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={!isValid} isLoading={isSubmitting}>
          Salvar alterações
        </Button>
      </form>
    </main>
  );
}
