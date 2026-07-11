'use client';

import {
  ApiError,
  CNH_CATEGORY_OPTIONS,
  createSkillCategory,
  extractDigits,
  formatCpf,
  listSkillCategories,
  logout,
  SkillCategory,
  WORKER_RATING_CATEGORIES,
} from '@shift/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Avatar } from '../../../components/ui/avatar';
import { Button } from '../../../components/ui/button';
import { Chip } from '../../../components/ui/chip';
import { Input } from '../../../components/ui/input';
import { StatCard } from '../../../components/ui/stat-card';
import { getCurrentPosition } from '../../../lib/geolocation';
import {
  listWorkerRatings,
  updateWorkerLocation,
  UpsertWorkerProfileResponse,
  uploadWorkerPhoto,
  upsertWorkerProfile,
  WorkerRatingHistoryEntry,
} from '../../../lib/worker-profile-api';
import { useWorkerProfile } from '../worker-profile-context';

const KYC_STATUS_LABEL: Record<string, string> = {
  pending: 'Documento em análise',
  approved: 'Identidade verificada',
  rejected: 'Documento recusado',
};

const KYC_STATUS_CLASS: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-danger/10 text-danger',
};

function formatShiftDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(iso));
}

export default function PerfilPage() {
  const router = useRouter();
  const { profile, setProfile } = useWorkerProfile();
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>(profile?.categoryIds ?? []);
  const [isSavingCategories, setIsSavingCategories] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [savingExperienceCategoryId, setSavingExperienceCategoryId] = useState<string | null>(null);

  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [cpf, setCpf] = useState(profile?.cpf ?? '');
  const [homeAddressFull, setHomeAddressFull] = useState(profile?.homeAddressFull ?? '');
  const [cnhCategory, setCnhCategory] = useState(profile?.cnhCategory ?? '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [ratingHistory, setRatingHistory] = useState<WorkerRatingHistoryEntry[]>([]);
  const [isLoadingRatingHistory, setIsLoadingRatingHistory] = useState(true);

  useEffect(() => {
    listSkillCategories()
      .then((data) => setCategories(data.categories))
      .catch(() => setCategoriesError('Não foi possível carregar as categorias.'))
      .finally(() => setIsLoadingCategories(false));
  }, []);

  useEffect(() => {
    listWorkerRatings()
      .then((data) => setRatingHistory(data.ratings))
      .catch(() => undefined)
      .finally(() => setIsLoadingRatingHistory(false));
  }, []);

  async function handleLogout(): Promise<void> {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      router.push('/entrar');
    }
  }

  function applyUpdate(updated: UpsertWorkerProfileResponse): void {
    if (!profile) return;
    setProfile({ ...profile, ...updated });
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    setPhotoError(null);
    setIsUploadingPhoto(true);
    try {
      const { photoUrl } = await uploadWorkerPhoto(file);
      setProfile({ ...profile, photoUrl });
    } catch {
      setPhotoError('Não foi possível enviar a foto.');
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function toggleCategory(categoryId: string): Promise<void> {
    if (!profile || isSavingCategories) return;

    const next = selectedIds.includes(categoryId)
      ? selectedIds.filter((id) => id !== categoryId)
      : [...selectedIds, categoryId];
    if (next.length === 0) {
      setCategoriesError('Você precisa ter ao menos uma categoria.');
      return;
    }

    const previous = selectedIds;
    setSelectedIds(next);
    setCategoriesError(null);
    setIsSavingCategories(true);
    try {
      const updated = await upsertWorkerProfile({ fullName: profile.fullName, categoryIds: next });
      applyUpdate(updated);
    } catch (err) {
      setSelectedIds(previous);
      setCategoriesError(err instanceof ApiError ? err.message : 'Não foi possível atualizar as categorias.');
    } finally {
      setIsSavingCategories(false);
    }
  }

  async function toggleExperience(categoryId: string): Promise<void> {
    if (!profile || savingExperienceCategoryId) return;

    const nextValue = !profile.experienceByCategory[categoryId];
    setSavingExperienceCategoryId(categoryId);
    setCategoriesError(null);
    try {
      const updated = await upsertWorkerProfile({
        fullName: profile.fullName,
        categoryIds: selectedIds,
        experienceByCategory: { [categoryId]: nextValue },
      });
      applyUpdate(updated);
    } catch (err) {
      setCategoriesError(err instanceof ApiError ? err.message : 'Não foi possível atualizar a experiência.');
    } finally {
      setSavingExperienceCategoryId(null);
    }
  }

  async function handleCreateCategory(): Promise<void> {
    const trimmedName = newCategoryName.trim();
    if (trimmedName.length < 2 || isCreatingCategory || !profile) return;

    setCategoriesError(null);
    setIsCreatingCategory(true);
    try {
      const category = await createSkillCategory(trimmedName);
      setCategories((current) =>
        current.some((existing) => existing.id === category.id) ? current : [...current, category],
      );
      const next = selectedIds.includes(category.id) ? selectedIds : [...selectedIds, category.id];
      setSelectedIds(next);
      const updated = await upsertWorkerProfile({ fullName: profile.fullName, categoryIds: next });
      applyUpdate(updated);
      setNewCategoryName('');
      setIsAddingCategory(false);
    } catch (err) {
      setCategoriesError(err instanceof ApiError ? err.message : 'Não foi possível criar a categoria.');
    } finally {
      setIsCreatingCategory(false);
    }
  }

  async function handleUpdateLocation(): Promise<void> {
    if (!profile || isUpdatingLocation) return;

    setLocationError(null);
    setIsUpdatingLocation(true);
    try {
      const position = await getCurrentPosition('Precisamos da sua localização pra atualizar seu endereço.');
      const result = await updateWorkerLocation(position.coords.latitude, position.coords.longitude);
      setProfile({ ...profile, homeAddressLabel: result.homeAddressLabel });
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : 'Não foi possível atualizar sua localização.');
    } finally {
      setIsUpdatingLocation(false);
    }
  }

  const isProfileFormValid = fullName.trim().length >= 2 && homeAddressFull.trim().length >= 8;

  async function handleSaveProfile(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isProfileFormValid || isSavingProfile || !profile) return;

    setProfileError(null);
    setProfileSaved(false);
    setIsSavingProfile(true);
    try {
      const updated = await upsertWorkerProfile({
        fullName,
        categoryIds: profile.categoryIds,
        bio: bio.trim() || undefined,
        cpf: cpf.trim() || undefined,
        homeAddressFull: homeAddressFull.trim(),
        cnhCategory,
      });
      applyUpdate(updated);
      setProfileSaved(true);
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : 'Não foi possível salvar seu perfil.');
    } finally {
      setIsSavingProfile(false);
    }
  }

  if (!profile) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 text-center">
        <p className="text-sm text-danger">Perfil não encontrado.</p>
      </main>
    );
  }

  const isVerified = profile.kycStatus === 'approved';

  return (
    <main className="flex flex-1 flex-col gap-7 px-5 py-8">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar name={profile.fullName} photoUrl={profile.photoUrl} size="xl" color="bg-secondary" />
          <label className="absolute -right-1 -bottom-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-[0_2px_6px_rgba(0,0,0,0.2)]">
            {isUploadingPhoto ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 20c0-4 3.6-6 8-6s8 2 8 6M12 12a4 4 0 100-8 4 4 0 000 8z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={handlePhotoChange}
              disabled={isUploadingPhoto}
              className="sr-only"
            />
          </label>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="font-heading text-2xl font-bold tracking-[-0.02em] text-text">{profile.fullName}</h1>
            {isVerified && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" fill="#17A860" />
                <path d="M7.5 12.5l3 3 6-6.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <span
            className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
              KYC_STATUS_CLASS[profile.kycStatus] ?? KYC_STATUS_CLASS.pending
            }`}
          >
            {KYC_STATUS_LABEL[profile.kycStatus] ?? profile.kycStatus}
          </span>
        </div>
      </div>
      {photoError && <p className="-mt-4 text-xs text-danger">{photoError}</p>}

      <div className="flex gap-3">
        <StatCard label="horas trabalhadas" value={`${profile.totalHoursWorked}h`} />
        <StatCard label="turnos" value={String(profile.totalShiftsCompleted)} />
        <StatCard label="nota média" value={profile.avgRating ? `★ ${profile.avgRating}` : '—'} />
      </div>

      {profile.avgCategoryScores && (
        <div>
          <h2 className="font-heading text-[17px] font-bold text-text">Seus pontos fortes</h2>
          <p className="mt-1 text-xs text-text-secondary">
            A média de cada categoria que as empresas avaliaram em você — aparece pra elas quando você se
            candidata a uma vaga.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {WORKER_RATING_CATEGORIES.flatMap((category) => {
              const score = profile.avgCategoryScores?.[category.id];
              if (!score) return [];
              return [
                <span
                  key={category.id}
                  className="rounded-full bg-primary/10 px-3 py-1.5 text-[12.5px] font-semibold text-primary"
                >
                  ★ {score} {category.label}
                </span>,
              ];
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="font-heading text-[17px] font-bold text-text">Seu histórico</h2>
        <div className="mt-2.5 flex flex-wrap gap-3">
          <StatCard label="empresas atendidas" value={String(profile.companiesServed)} />
          <StatCard
            label="comparecimento"
            value={profile.attendanceRate !== null ? `${profile.attendanceRate}%` : '—'}
          />
          <StatCard label="cancelamentos" value={String(profile.cancellations)} />
          <StatCard
            label="taxa de recontratação"
            value={profile.rehireRate !== null ? `${profile.rehireRate}%` : '—'}
          />
        </div>
      </div>

      {!isLoadingRatingHistory && ratingHistory.length > 0 && (
        <div>
          <h2 className="font-heading text-[17px] font-bold text-text">Avaliações recebidas</h2>
          <ul className="mt-2.5 flex flex-col gap-3">
            {ratingHistory.map((entry) => {
              const categoryName = categories.find((category) => category.id === entry.categoryId)?.name;
              return (
                <li
                  key={entry.id}
                  className="rounded-2xl border border-border bg-surface p-4 shadow-[0_4px_14px_rgba(26,23,18,0.05)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-heading text-[15px] font-bold text-text">{entry.companyName}</p>
                    <span className="whitespace-nowrap text-sm font-bold text-primary">★ {entry.score}</span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {[categoryName, formatShiftDate(entry.shiftDate)].filter(Boolean).join(' · ')}
                  </p>
                  {entry.comment && <p className="mt-2 text-sm text-text">"{entry.comment}"</p>}
                  {entry.categoryScores && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {WORKER_RATING_CATEGORIES.flatMap((category) => {
                        const score = entry.categoryScores?.[category.id];
                        if (!score) return [];
                        return [
                          <span
                            key={category.id}
                            className="rounded-lg bg-background px-2 py-1 text-[11.5px] font-semibold text-text-secondary"
                          >
                            ★{score} {category.label}
                          </span>,
                        ];
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div>
        <h2 className="font-heading text-[17px] font-bold text-text">Minhas funções</h2>
        <p className="mt-1 text-xs text-text-secondary">Toque pra adicionar ou remover uma função.</p>
        {categoriesError && <p className="mt-1.5 text-xs text-danger">{categoriesError}</p>}
        <div className="mt-2.5 flex flex-wrap gap-2">
          {isLoadingCategories ? (
            <p className="text-sm text-text-secondary">Carregando categorias...</p>
          ) : (
            <>
              {categories.map((category) => {
                const isSelected = selectedIds.includes(category.id);
                const hasExperience = Boolean(profile.experienceByCategory[category.id]);
                return (
                  <Chip
                    key={category.id}
                    active={isSelected}
                    onClick={() => toggleCategory(category.id)}
                    disabled={isSavingCategories}
                  >
                    {isSelected ? (hasExperience ? `${category.name} ✓` : category.name) : `+ ${category.name}`}
                  </Chip>
                );
              })}
              {!isAddingCategory && (
                <Chip onClick={() => setIsAddingCategory(true)}>+ Criar categoria</Chip>
              )}
            </>
          )}
        </div>

        {isAddingCategory && (
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
                }}
                className="text-sm text-text-secondary underline underline-offset-2"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {selectedIds.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-text-secondary">Você já tem experiência nessas funções?</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {selectedIds.flatMap((categoryId) => {
                const category = categories.find((c) => c.id === categoryId);
                if (!category) return [];
                const hasExperience = Boolean(profile.experienceByCategory[categoryId]);
                return [
                  <Chip
                    key={categoryId}
                    active={hasExperience}
                    onClick={() => toggleExperience(categoryId)}
                    disabled={savingExperienceCategoryId === categoryId}
                    aria-label={`Experiência em ${category.name}`}
                  >
                    {hasExperience ? `${category.name} ✓` : category.name}
                  </Chip>,
                ];
              })}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-6">
        <h2 className="font-heading text-[17px] font-bold text-text">Localização</h2>
        <p className="mt-1 text-xs text-text-secondary">
          Usada pra mostrar turnos perto de você. Atualize se você mudou de endereço.
        </p>
        <p className="mt-2.5 text-sm text-text">
          {profile.homeAddressLabel ?? 'Nenhum endereço definido ainda.'}
        </p>
        <Button
          type="button"
          variant="outlined"
          onClick={handleUpdateLocation}
          isLoading={isUpdatingLocation}
          className="mt-2.5"
        >
          Atualizar localização
        </Button>
        {locationError && <p className="mt-1.5 text-sm text-danger">{locationError}</p>}
      </div>

      <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 border-t border-border pt-6">
        <h2 className="font-heading text-[17px] font-bold text-text">Editar perfil</h2>

        <Input
          id="fullName"
          label="Nome completo"
          type="text"
          value={fullName}
          onChange={(event) => {
            setFullName(event.target.value);
            setProfileSaved(false);
          }}
        />

        <div>
          <label htmlFor="bio" className="mb-1.5 block text-sm font-medium text-text-secondary">
            Sobre mim (opcional)
          </label>
          <textarea
            id="bio"
            rows={3}
            placeholder="Conte sua experiência pras empresas verem no seu perfil..."
            value={bio}
            onChange={(event) => {
              setBio(event.target.value);
              setProfileSaved(false);
            }}
            className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-text transition focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
          />
        </div>

        <Input
          id="cpf"
          label="CPF"
          type="text"
          inputMode="numeric"
          placeholder="000.000.000-00"
          maxLength={14}
          value={formatCpf(cpf)}
          onChange={(event) => {
            setCpf(extractDigits(event.target.value).slice(0, 11));
            setProfileSaved(false);
          }}
        />

        <div>
          <Input
            id="homeAddressFull"
            label="Endereço completo"
            type="text"
            placeholder="Rua, número, bairro, cidade - UF"
            value={homeAddressFull}
            onChange={(event) => {
              setHomeAddressFull(event.target.value);
              setProfileSaved(false);
            }}
          />
          <p className="mt-1.5 text-xs text-text-secondary">
            Protegido — empresas nunca veem esse endereço, só usamos pra confirmar sua identidade.
          </p>
        </div>

        <div>
          <label htmlFor="cnhCategory" className="mb-1.5 block text-sm font-medium text-text-secondary">
            Categoria da CNH (opcional)
          </label>
          <select
            id="cnhCategory"
            value={cnhCategory}
            onChange={(event) => {
              setCnhCategory(event.target.value);
              setProfileSaved(false);
            }}
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

        {profileError && <p className="text-sm text-danger">{profileError}</p>}

        {profileSaved ? (
          <div className="flex flex-col gap-2.5">
            <p className="text-sm text-success">Perfil salvo.</p>
            <Button type="button" onClick={() => router.push('/inicio')} className="self-start">
              Concluir
            </Button>
          </div>
        ) : (
          <Button type="submit" disabled={!isProfileFormValid} isLoading={isSavingProfile} className="self-start">
            Salvar perfil
          </Button>
        )}
      </form>

      <Link
        href="/candidaturas"
        className="text-center text-sm font-semibold text-primary underline underline-offset-2"
      >
        Minhas candidaturas
      </Link>

      <Button variant="outlined" onClick={handleLogout} isLoading={isLoggingOut}>
        Sair da conta
      </Button>
    </main>
  );
}
