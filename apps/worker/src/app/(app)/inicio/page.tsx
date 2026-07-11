'use client';

import { ApiError, listSkillCategories } from '@shift/shared';
import { useEffect, useState } from 'react';
import { Avatar } from '../../../components/ui/avatar';
import { Button } from '../../../components/ui/button';
import { Chip } from '../../../components/ui/chip';
import { MapLink } from '../../../components/ui/map-link';
import { listMyApplications, markApplicationSeen, markRemovalSeen, MyApplication } from '../../../lib/applications-api';
import { getCurrentPosition } from '../../../lib/geolocation';
import { applyToJob, listNearbyJobs, NearbyJob } from '../../../lib/jobs-api';
import { updateWorkerLocation } from '../../../lib/worker-profile-api';
import { useWorkerProfile } from '../worker-profile-context';

const CATEGORY_LABEL_FALLBACK = 'Categoria';
const AVAILABILITY_STORAGE_KEY = 'pronto:disponivel';

type DateFilter = 'todos' | 'hoje' | 'amanha' | 'fds';

function formatDateRange(startsAt: string, endsAt: string): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return `${formatter.format(new Date(startsAt))} até ${formatter.format(new Date(endsAt))}`;
}

function formatHours(startsAt: string, endsAt: string): string {
  const hours = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / (60 * 60 * 1000);
  return `${Math.round(hours)}h`;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia,';
  if (hour < 18) return 'Boa tarde,';
  return 'Boa noite,';
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
  const { profile } = useWorkerProfile();
  const [jobs, setJobs] = useState<NearbyJob[]>([]);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<DateFilter>('todos');

  // Só visual/local por enquanto — nenhuma empresa "navega" trabalhadores
  // hoje, então não há regra de negócio consumindo isso ainda. Lido de
  // forma preguiçosa (lazy initializer) em vez de um efeito, pra não
  // disparar uma renderização em cascata logo após o mount.
  const [available, setAvailable] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem(AVAILABILITY_STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  });

  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<{ jobId: string; message: string } | null>(null);
  const [confirmedExperienceJobIds, setConfirmedExperienceJobIds] = useState<Set<string>>(new Set());

  const [calledApplications, setCalledApplications] = useState<MyApplication[]>([]);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const [removedApplications, setRemovedApplications] = useState<MyApplication[]>([]);
  const [dismissingRemovalId, setDismissingRemovalId] = useState<string | null>(null);

  function toggleAvailable(): void {
    setAvailable((current) => {
      const next = !current;
      window.localStorage.setItem(AVAILABILITY_STORAGE_KEY, String(next));
      return next;
    });
  }

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

    // Alertas de "foi chamado pra trabalhar" e "foi removido do turno"
    // são secundários — se essa chamada falhar, a tela principal de
    // vagas continua funcionando.
    listMyApplications()
      .then(({ applications }) => {
        setCalledApplications(applications.filter((a) => a.status === 'approved' && a.workerSeenAt === null));
        setRemovedApplications(applications.filter((a) => a.removedAt !== null && a.workerSeenRemovalAt === null));
      })
      .catch(() => undefined);
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
              className="rounded-[18px] border border-success/30 bg-success/10 p-4 text-success"
            >
              <p className="font-heading text-[15px] font-bold">
                Você foi chamado(a) pra trabalhar em {application.companyName || 'uma vaga'}! 🎉
              </p>
              <p className="mt-1 text-[13px]">
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
            <li key={application.id} className="rounded-[18px] border border-danger/30 bg-danger/10 p-4 text-danger">
              <p className="font-heading text-[15px] font-bold">
                {application.companyName || 'A empresa'} removeu você do turno de{' '}
                {categoryNames[application.job.categoryId] ?? CATEGORY_LABEL_FALLBACK}.
              </p>
              <p className="mt-1 text-[13px]">{formatDateRange(application.job.startsAt, application.job.endsAt)}</p>
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

      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-text-secondary">{greeting()}</p>
          <p className="font-heading text-[28px] leading-tight font-bold tracking-[-0.02em] text-text">
            {profile?.fullName ?? ''}
          </p>
          {profile?.homeAddressLabel && (
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-text-secondary">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="2" />
              </svg>
              {profile.homeAddressLabel}
            </p>
          )}
        </div>
        {profile && <Avatar name={profile.fullName} photoUrl={profile.photoUrl} size="md" color="bg-secondary" />}
      </div>

      <button
        type="button"
        onClick={toggleAvailable}
        className={`mt-4 flex items-center justify-between rounded-[18px] p-4 text-left shadow-[0_6px_18px_rgba(26,23,18,0.06)] transition ${
          available ? 'bg-success/10' : 'bg-surface'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${available ? 'bg-success' : 'bg-text-secondary'}`} />
          <div>
            <p className={`text-[16px] font-bold ${available ? 'text-success' : 'text-text'}`}>
              {available ? 'Disponível para turnos' : 'Indisponível'}
            </p>
            <p className="text-[12.5px] text-text-secondary">
              {available ? 'Você aparece para empresas perto de você' : 'Toque para voltar a receber turnos'}
            </p>
          </div>
        </div>
        <span
          className={`relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors ${
            available ? 'bg-success' : 'bg-border'
          }`}
        >
          <span
            className={`absolute top-[3px] h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-all ${
              available ? 'left-[23px]' : 'left-[3px]'
            }`}
          />
        </span>
      </button>

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
        <h2 className="font-heading text-[18px] font-bold text-text">Turnos perto de você</h2>
        <span className="text-[13px] font-semibold text-primary">{visibleJobs.length} disponíveis</span>
      </div>

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
              className="rounded-[20px] border border-border bg-surface p-4 shadow-[0_4px_14px_rgba(26,23,18,0.05)]"
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
                    <p className="mt-1 text-[13.5px] text-text-secondary">
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
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-background px-2.5 py-1.5 text-[12.5px] font-semibold text-text">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="2" />
                    <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  {formatDateRange(job.startsAt, job.endsAt)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-background px-2.5 py-1.5 text-[12.5px] font-semibold text-text">
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
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-[12.5px] font-semibold text-warning">
                    Experiência necessária
                  </span>
                )}
                {job.cnhCategory && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold ${
                      job.cnhRequired ? 'bg-warning/10 text-warning' : 'bg-background text-text'
                    }`}
                  >
                    CNH {job.cnhCategory} {job.cnhRequired ? 'obrigatória' : '(preferência)'}
                  </span>
                )}
              </div>

              {!job.matchesSkills && (
                <p className="mt-2.5 rounded-lg bg-danger/10 px-2.5 py-1.5 text-[12.5px] font-semibold text-danger">
                  Você não tem essa especialidade no seu perfil — pode se candidatar mesmo assim.
                </p>
              )}

              {job.experienceMismatch && (
                <label className="mt-2.5 flex items-start gap-2 rounded-lg bg-danger/10 px-2.5 py-2 text-[12.5px] font-semibold text-danger">
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
                <p className="mt-2.5 rounded-lg bg-danger/10 px-2.5 py-1.5 text-[12.5px] font-semibold text-danger">
                  {job.cnhRequired
                    ? `Essa vaga exige CNH categoria ${job.cnhCategory} — você não tem essa categoria no perfil, então não pode se candidatar.`
                    : `Essa vaga prefere CNH categoria ${job.cnhCategory} — você pode se candidatar mesmo assim.`}
                </p>
              )}

              <MapLink
                addressLabel={job.addressLabel}
                lat={job.locationLat}
                lng={job.locationLng}
                className="mt-2 text-[13.5px]"
              />
              {job.dressCode && (
                <p className="mt-1 text-[13.5px] text-text-secondary">
                  <span className="font-semibold text-text">Vestimenta:</span> {job.dressCode}
                </p>
              )}
              {job.toolsRequired && (
                <p className="mt-1 text-[13.5px] text-text-secondary">
                  <span className="font-semibold text-text">Leve com você:</span> {job.toolsRequired}
                </p>
              )}

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
                {applied ? 'Candidatura enviada ✓' : 'Aceitar turno'}
              </Button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
