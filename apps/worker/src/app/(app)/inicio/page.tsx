'use client';

import { ApiError, formatBenefitLabel, listSkillCategories } from '@shift/shared';
import Link from 'next/link';
import { ChangeEvent, useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Chip } from '../../../components/ui/chip';
import { MapLink } from '../../../components/ui/map-link';
import { listMyApplications, markApplicationSeen, markRemovalSeen, MyApplication } from '../../../lib/applications-api';
import { getCurrentPosition } from '../../../lib/geolocation';
import { applyToJob, listNearbyJobs, NearbyJob } from '../../../lib/jobs-api';
import { listMyShifts } from '../../../lib/shifts-api';
import { updateSearchRadius, updateWorkerLocation } from '../../../lib/worker-profile-api';
import { NOTIFICATIONS_POLL_INTERVAL_MS } from '../layout';
import { useWorkerProfile } from '../worker-profile-context';

const CATEGORY_LABEL_FALLBACK = 'Categoria';

const SEARCH_RADIUS_OPTIONS_KM = [5, 10, 20, 30, 50, 100];

type DateFilter = 'todos' | 'hoje' | 'amanha' | 'fds';

function formatDateRange(startsAt: string, endsAt: string): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return `${formatter.format(new Date(startsAt))} até ${formatter.format(new Date(endsAt))}`;
}

function formatHours(startsAt: string, endsAt: string): string {
  const hours = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / (60 * 60 * 1000);
  return `${Math.round(hours)}h`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function matchesFilter(job: NearbyJob, filter: DateFilter): boolean {
  if (filter === 'todos') return true;

  const start = new Date(job.startsAt);
  const now = new Date();

  if (filter === 'hoje') return isSameDay(start, now);
  if (filter === 'amanha') {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return isSameDay(start, tomorrow);
  }
  // fim de semana: sábado (6) ou domingo (0), a partir de hoje
  return start >= now && (start.getDay() === 0 || start.getDay() === 6);
}

/**
 * GET /jobs/nearby responde 400 quando o worker ainda não definiu
 * localização — nesse caso, pede a localização ao navegador, salva, e
 * tenta de novo uma vez. Qualquer outro erro sobe direto.
 */
async function fetchNearbyJobs(): Promise<{ jobs: NearbyJob[] }> {
  try {
    return await listNearbyJobs();
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 400) {
      throw err;
    }
    const position = await getCurrentPosition('Precisamos da sua localização pra mostrar vagas perto de você.');
    await updateWorkerLocation(position.coords.latitude, position.coords.longitude);
    return listNearbyJobs();
  }
}

export default function InicioPage() {
  const { profile, setProfile } = useWorkerProfile();
  const [jobs, setJobs] = useState<NearbyJob[]>([]);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [isUpdatingRadius, setIsUpdatingRadius] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<DateFilter>('todos');

  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<{ jobId: string; message: string } | null>(null);
  const [confirmedExperienceJobIds, setConfirmedExperienceJobIds] = useState<Set<string>>(new Set());

  const [calledApplications, setCalledApplications] = useState<MyApplication[]>([]);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const [removedApplications, setRemovedApplications] = useState<MyApplication[]>([]);
  const [dismissingRemovalId, setDismissingRemovalId] = useState<string | null>(null);

  const [pendingRatingsCount, setPendingRatingsCount] = useState(0);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const [jobsResult, categoriesResult] = await Promise.all([fetchNearbyJobs(), listSkillCategories()]);
        setJobs(jobsResult.jobs);
        setCategoryNames(Object.fromEntries(categoriesResult.categories.map((c) => [c.id, c.name])));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível carregar as vagas.');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Alertas de "foi chamado pra trabalhar", "foi removido da escala" e
    // "escala concluída esperando avaliação" são secundários — se essa
    // busca falhar, a tela principal de vagas continua funcionando.
    // Faz polling no mesmo intervalo que o sino do layout (ver
    // NOTIFICATIONS_POLL_INTERVAL_MS em ../layout.tsx) pra não deixar o
    // banner desatualizado enquanto o sino já mostra a notificação nova.
    function poll(): void {
      listMyApplications()
        .then(({ applications }) => {
          if (cancelled) return;
          setCalledApplications(applications.filter((a) => a.status === 'approved' && a.workerSeenAt === null));
          setRemovedApplications(applications.filter((a) => a.removedAt !== null && a.workerSeenRemovalAt === null));
        })
        .catch(() => undefined);

      listMyShifts()
        .then(({ shifts }) => {
          if (cancelled) return;
          setPendingRatingsCount(shifts.filter((shift) => shift.status === 'completed' && !shift.ratings.worker).length);
        })
        .catch(() => undefined);
    }

    poll();
    const intervalId = setInterval(poll, NOTIFICATIONS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  async function handleDismissCalled(applicationId: string): Promise<void> {
    setDismissingId(applicationId);
    try {
      await markApplicationSeen(applicationId);
      setCalledApplications((current) => current.filter((a) => a.id !== applicationId));
    } catch {
      // Falhou marcar como visto — deixa o alerta visível, tenta de novo na próxima.
    } finally {
      setDismissingId(null);
    }
  }

  async function handleDismissRemoval(applicationId: string): Promise<void> {
    setDismissingRemovalId(applicationId);
    try {
      await markRemovalSeen(applicationId);
      setRemovedApplications((current) => current.filter((a) => a.id !== applicationId));
    } catch {
      // Falhou marcar como visto — deixa o alerta visível, tenta de novo na próxima.
    } finally {
      setDismissingRemovalId(null);
    }
  }

  function toggleExperienceConfirmation(jobId: string): void {
    setConfirmedExperienceJobIds((current) => {
      const next = new Set(current);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  }

  async function handleUpdateLocation(): Promise<void> {
    setLocationError(null);
    setIsUpdatingLocation(true);
    try {
      const position = await getCurrentPosition('Precisamos da sua localização pra mostrar vagas perto de você.');
      const result = await updateWorkerLocation(position.coords.latitude, position.coords.longitude);
      if (profile) {
        setProfile({
          ...profile,
          homeAddressLabel: result.homeAddressLabel,
          homeLat: result.homeLat,
          homeLng: result.homeLng,
        });
      }
      const jobsResult = await listNearbyJobs();
      setJobs(jobsResult.jobs);
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : 'Não foi possível atualizar sua localização.');
    } finally {
      setIsUpdatingLocation(false);
    }
  }

  async function handleRadiusChange(event: ChangeEvent<HTMLSelectElement>): Promise<void> {
    const searchRadiusKm = Number(event.target.value);
    setLocationError(null);
    setIsUpdatingRadius(true);
    try {
      await updateSearchRadius(searchRadiusKm);
      if (profile) setProfile({ ...profile, searchRadiusKm });
      const jobsResult = await listNearbyJobs();
      setJobs(jobsResult.jobs);
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : 'Não foi possível atualizar o raio de busca.');
    } finally {
      setIsUpdatingRadius(false);
    }
  }

  async function handleApply(jobId: string): Promise<void> {
    setApplyError(null);
    setApplyingJobId(jobId);

    try {
      await applyToJob(jobId);
      setAppliedJobIds((current) => new Set(current).add(jobId));
    } catch (err) {
      setApplyError({
        jobId,
        message: err instanceof ApiError ? err.message : 'Não foi possível enviar sua candidatura.',
      });
    } finally {
      setApplyingJobId(null);
    }
  }

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Buscando vagas perto de você...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 text-center">
        <p className="text-sm text-danger">{error}</p>
      </main>
    );
  }

  const visibleJobs = jobs.filter((job) => matchesFilter(job, filter));

  return (
    <main className="flex flex-1 flex-col gap-1 px-5 py-8">
      {calledApplications.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2.5">
          {calledApplications.map((application) => (
            <li
              key={application.id}
              className="rounded-lg border border-success/30 bg-success/10 p-4 text-success"
            >
              <p className="font-heading text-[16px] font-bold">
                Você foi chamado(a) pra trabalhar em {application.companyName || 'uma vaga'}!{' '}
                <svg
                  className="inline-block h-[0.9em] w-[0.9em] align-[-0.1em]"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </p>
              <p className="mt-1 text-[14px]">
                {categoryNames[application.job.categoryId] ?? CATEGORY_LABEL_FALLBACK} ·{' '}
                {formatDateRange(application.job.startsAt, application.job.endsAt)}
              </p>
              <Button
                type="button"
                variant="success"
                isLoading={dismissingId === application.id}
                onClick={() => handleDismissCalled(application.id)}
                className="mt-3"
              >
                Ok, entendi
              </Button>
            </li>
          ))}
        </ul>
      )}

      {removedApplications.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2.5">
          {removedApplications.map((application) => (
            <li key={application.id} className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-danger">
              <p className="font-heading text-[16px] font-bold">
                {application.companyName || 'A empresa'} removeu você da escala de{' '}
                {categoryNames[application.job.categoryId] ?? CATEGORY_LABEL_FALLBACK}.
              </p>
              <p className="mt-1 text-[14px]">{formatDateRange(application.job.startsAt, application.job.endsAt)}</p>
              <Button
                type="button"
                variant="danger"
                isLoading={dismissingRemovalId === application.id}
                onClick={() => handleDismissRemoval(application.id)}
                className="mt-3"
              >
                Ok, entendi
              </Button>
            </li>
          ))}
        </ul>
      )}

      {pendingRatingsCount > 0 && (
        <Link
          href="/agenda"
          className="mb-4 block rounded-lg border border-warning/30 bg-warning/10 p-4 text-warning"
        >
          <p className="font-heading text-[16px] font-bold">
            {pendingRatingsCount === 1
              ? '1 escala concluída esperando sua avaliação'
              : `${pendingRatingsCount} escalas concluídas esperando sua avaliação`}
          </p>
          <p className="mt-1 text-[14px]">Toque para avaliar na Agenda.</p>
        </Link>
      )}

      {profile && profile.kycStatus !== 'approved' && (
        <Link
          href="/perfil"
          className={`mb-4 block rounded-lg border p-4 ${
            profile.kycStatus === 'rejected'
              ? 'border-danger/30 bg-danger/10 text-danger'
              : 'border-warning/30 bg-warning/10 text-warning'
          }`}
        >
          <p className="font-heading text-[16px] font-bold">
            {profile.kycStatus === 'rejected'
              ? 'Documento recusado — você ainda não pode se candidatar'
              : 'Documento em análise — você ainda não pode se candidatar'}
          </p>
          <p className="mt-1 text-[14px]">
            {profile.kycStatus === 'rejected'
              ? 'Toque pra ver o status no seu perfil.'
              : 'Assim que for aprovado, as vagas ficam liberadas pra você.'}
          </p>
        </Link>
      )}

      {profile?.homeAddressLabel && (
        <p className="flex items-center gap-1.5 text-[14px] text-text-secondary">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="2" />
          </svg>
          {profile.homeAddressLabel}
        </p>
      )}

      <div className="scrollbar-none mt-5 flex gap-2.5 overflow-x-auto pb-1">
        <Chip active={filter === 'todos'} onClick={() => setFilter('todos')}>
          Todos
        </Chip>
        <Chip active={filter === 'hoje'} onClick={() => setFilter('hoje')}>
          Hoje
        </Chip>
        <Chip active={filter === 'amanha'} onClick={() => setFilter('amanha')}>
          Amanhã
        </Chip>
        <Chip active={filter === 'fds'} onClick={() => setFilter('fds')}>
          Fim de semana
        </Chip>
      </div>

      <div className="mt-3.5 flex items-baseline justify-between">
        <h2 className="font-heading text-[19px] font-bold text-text">Escalas perto de você</h2>
        <span className="text-[14px] font-semibold text-primary">{visibleJobs.length} disponíveis</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outlined"
          onClick={handleUpdateLocation}
          isLoading={isUpdatingLocation}
          className="px-3 py-1.5 text-xs"
        >
          {profile?.homeAddressLabel ? 'Atualizar localização' : 'Definir localização'}
        </Button>
        <label className="flex items-center gap-1.5 text-[14px] text-text-secondary">
          Raio de busca
          <select
            value={profile?.searchRadiusKm ?? 10}
            onChange={handleRadiusChange}
            disabled={isUpdatingRadius}
            className="rounded-md border border-border bg-surface px-2 py-1 text-[14px] text-text"
          >
            {SEARCH_RADIUS_OPTIONS_KM.map((km) => (
              <option key={km} value={km}>
                {km} km
              </option>
            ))}
          </select>
        </label>
      </div>
      {locationError && <p className="mt-1.5 text-xs text-danger">{locationError}</p>}
      <p className="mt-1 text-[11px] text-text-secondary">
        Se você não atualizar, usamos o endereço já cadastrado.
      </p>

      {visibleJobs.length === 0 && (
        <p className="mt-3 text-sm text-text-secondary">Nenhuma vaga disponível com esse filtro.</p>
      )}

      <ul className="mt-3 flex flex-col gap-3">
        {visibleJobs.map((job) => {
          const applied = appliedJobIds.has(job.id);
          const experienceConfirmed = confirmedExperienceJobIds.has(job.id);
          return (
            <li
              key={job.id}
              className="rounded-lg border border-border bg-surface p-4 shadow-[0_4px_14px_rgba(26,23,18,0.05)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {job.companyLogoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={job.companyLogoUrl}
                      alt={job.companyName}
                      className="mt-0.5 h-10 w-10 shrink-0 rounded-xl object-cover"
                    />
                  )}
                  <div>
                    <p className="font-heading text-[19px] leading-[1.05] font-bold text-text">
                      {categoryNames[job.categoryId] ?? CATEGORY_LABEL_FALLBACK}
                    </p>
                    <p className="mt-1 text-[14px] text-text-secondary">
                      {job.companyName}
                      {job.companyAvgRating && ` · ★ ${job.companyAvgRating}`}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-heading text-[19px] font-bold text-primary">R$ {job.payAmount}</p>
                  <p className="text-xs text-text-secondary">{formatHours(job.startsAt, job.endsAt)}</p>
                </div>
              </div>

              <div className="mt-3.5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-background px-2.5 py-1.5 text-[14px] font-semibold text-text">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="2" />
                    <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  {formatDateRange(job.startsAt, job.endsAt)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-background px-2.5 py-1.5 text-[14px] font-semibold text-text">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  {job.distanceKm} km
                </span>
                {job.requiresExperience && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-[14px] font-semibold text-warning">
                    Experiência necessária
                  </span>
                )}
                {job.cnhCategory && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[14px] font-semibold ${
                      job.cnhRequired ? 'bg-warning/10 text-warning' : 'bg-background text-text'
                    }`}
                  >
                    CNH {job.cnhCategory} {job.cnhRequired ? 'obrigatória' : '(preferência)'}
                  </span>
                )}
                {formatBenefitLabel(job.mealProvision, job.mealAmount, 'Alimentação') && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-background px-2.5 py-1.5 text-[14px] font-semibold text-text">
                    {formatBenefitLabel(job.mealProvision, job.mealAmount, 'Alimentação')}
                  </span>
                )}
                {formatBenefitLabel(job.transportProvision, job.transportAmount, 'Transporte') && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-background px-2.5 py-1.5 text-[14px] font-semibold text-text">
                    {formatBenefitLabel(job.transportProvision, job.transportAmount, 'Transporte')}
                  </span>
                )}
              </div>

              {!job.matchesSkills && (
                <p className="mt-2.5 rounded-lg bg-danger/10 px-2.5 py-1.5 text-[14px] font-semibold text-danger">
                  Você não tem essa especialidade no seu perfil — pode se candidatar mesmo assim.
                </p>
              )}

              {job.experienceMismatch && (
                <label className="mt-2.5 flex items-start gap-2 rounded-lg bg-danger/10 px-2.5 py-2 text-[14px] font-semibold text-danger">
                  <input
                    type="checkbox"
                    checked={experienceConfirmed}
                    onChange={() => toggleExperienceConfirmation(job.id)}
                    className="mt-0.5 shrink-0"
                  />
                  Essa vaga pede experiência anterior e você não tem isso declarado no perfil. Confirmo que
                  quero me candidatar mesmo assim.
                </label>
              )}

              {job.cnhMismatch && (
                <p className="mt-2.5 rounded-lg bg-danger/10 px-2.5 py-1.5 text-[14px] font-semibold text-danger">
                  {job.cnhRequired
                    ? `Essa vaga exige CNH categoria ${job.cnhCategory} — você não tem essa categoria no perfil, então não pode se candidatar.`
                    : `Essa vaga prefere CNH categoria ${job.cnhCategory} — você pode se candidatar mesmo assim.`}
                </p>
              )}

              <MapLink
                addressLabel={job.addressLabel}
                lat={job.locationLat}
                lng={job.locationLng}
                className="mt-2 text-[14px]"
              />
              {job.dressCode && (
                <p className="mt-1 text-[14px] text-text-secondary">
                  <span className="font-semibold text-text">Vestimenta:</span> {job.dressCode}
                </p>
              )}
              {job.toolsRequired && (
                <p className="mt-1 text-[14px] text-text-secondary">
                  <span className="font-semibold text-text">Leve com você:</span> {job.toolsRequired}
                </p>
              )}

              <Link
                href={`/vaga/${job.id}`}
                className="mt-2 inline-block text-[14px] font-semibold text-primary underline underline-offset-2"
              >
                Ver detalhes da vaga
              </Link>

              {applyError?.jobId === job.id && (
                <p className="mt-2 text-sm text-danger">{applyError.message}</p>
              )}

              <Button
                type="button"
                variant={applied ? 'outlined' : 'primary'}
                disabled={
                  applied || (job.experienceMismatch && !experienceConfirmed) || (job.cnhMismatch && job.cnhRequired)
                }
                isLoading={applyingJobId === job.id}
                onClick={() => handleApply(job.id)}
                className="mt-3.5 w-full"
              >
                {applied ? 'Candidatura enviada ✓' : 'Aceitar escala'}
              </Button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
