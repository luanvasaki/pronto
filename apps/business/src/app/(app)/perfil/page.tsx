'use client';

import {
  ApiError,
  COMPANY_RATING_CATEGORIES,
  extractDigits,
  formatCnpj,
  formatCpf,
  isValidCnpj,
  isValidCpf,
  isValidPassword,
  listSkillCategories,
  logout,
  SkillCategory,
} from '@shift/shared';
import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Avatar } from '../../../components/ui/avatar';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { NotificationsToggle } from '../../../components/ui/notifications-toggle';
import {
  BUSINESS_SEGMENTS,
  changePassword,
  CompanyRatingHistoryEntry,
  listCompanyRatings,
  uploadCompanyLogo,
  upsertCompanyProfile,
} from '../../../lib/company-profile-api';
import { useCompanyProfile } from '../company-profile-context';

function formatShiftDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(iso));
}

const VERIFICATION_STATUS_LABEL: Record<string, string> = {
  pending: 'Verificação em análise',
  approved: 'Empresa verificada',
  rejected: 'Verificação recusada',
};

const VERIFICATION_STATUS_CLASS: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-danger/10 text-danger',
};

export default function PerfilPage() {
  const router = useRouter();
  const { profile, setProfile } = useCompanyProfile();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const [legalName, setLegalName] = useState(profile?.legalName ?? '');
  const [tradeName, setTradeName] = useState(profile?.tradeName ?? '');
  const isIndividual = profile?.personType === 'fisica';
  const [cnpj, setCnpj] = useState(profile?.cnpj ?? '');
  const [cpf, setCpf] = useState(profile?.cpf ?? '');
  const [businessSegment, setBusinessSegment] = useState(profile?.businessSegment ?? '');
  const [businessSegmentOther, setBusinessSegmentOther] = useState(profile?.businessSegmentOther ?? '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<{
    legalName: string;
    tradeName: string;
    cnpj: string;
    cpf: string;
    businessSegment: string;
    businessSegmentOther: string;
  } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordChanged, setPasswordChanged] = useState(false);

  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [ratingHistory, setRatingHistory] = useState<CompanyRatingHistoryEntry[]>([]);
  const [isLoadingRatingHistory, setIsLoadingRatingHistory] = useState(true);

  // "Dados salvos." é sobre o último save — derivado comparando os
  // campos atuais com o snapshot salvo, em vez de um booleano próprio
  // resetado por efeito: mexer em qualquer campo depois de salvar já
  // deixa de bater com o snapshot, escondendo o aviso sozinho.
  const profileSaved =
    savedSnapshot !== null &&
    savedSnapshot.legalName === legalName &&
    savedSnapshot.tradeName === tradeName &&
    savedSnapshot.cnpj === cnpj &&
    savedSnapshot.cpf === cpf &&
    savedSnapshot.businessSegment === businessSegment &&
    savedSnapshot.businessSegmentOther === businessSegmentOther;

  useEffect(() => {
    listSkillCategories()
      .then((data) => setCategories(data.categories))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    listCompanyRatings()
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

  async function handleLogoChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    setLogoError(null);
    setIsUploadingLogo(true);
    try {
      const { logoUrl } = await uploadCompanyLogo(file);
      setProfile({ ...profile, logoUrl });
    } catch {
      setLogoError('Não foi possível enviar o logo.');
    } finally {
      setIsUploadingLogo(false);
    }
  }

  const isProfileValid =
    legalName.trim().length >= 2 &&
    tradeName.trim().length >= 2 &&
    (isIndividual ? isValidCpf(cpf.trim()) : isValidCnpj(cnpj.trim())) &&
    (businessSegment !== 'outro' || businessSegmentOther.trim().length >= 2);

  async function handleSaveProfile(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isProfileValid || isSavingProfile || !profile) return;

    setProfileError(null);
    setIsSavingProfile(true);

    try {
      const updated = await upsertCompanyProfile({
        legalName,
        tradeName,
        personType: profile.personType,
        cnpj: isIndividual ? undefined : cnpj,
        cpf: isIndividual ? cpf : undefined,
        businessSegment: businessSegment || undefined,
        businessSegmentOther: businessSegment === 'outro' ? businessSegmentOther.trim() : undefined,
      });
      setProfile({ ...profile, ...updated });
      setSavedSnapshot({ legalName, tradeName, cnpj, cpf, businessSegment, businessSegmentOther });
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : 'Não foi possível salvar os dados da empresa.');
    } finally {
      setIsSavingProfile(false);
    }
  }

  const passwordsMatch = newPassword === confirmNewPassword;
  const isPasswordFormValid =
    currentPassword.length > 0 && isValidPassword(newPassword) && passwordsMatch;

  async function handleChangePassword(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isPasswordFormValid || isChangingPassword) return;

    setPasswordError(null);
    setPasswordChanged(false);
    setIsChangingPassword(true);

    try {
      await changePassword(currentPassword, newPassword);
      setPasswordChanged(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : 'Não foi possível trocar a senha.');
    } finally {
      setIsChangingPassword(false);
    }
  }

  if (!profile) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 text-center">
        <p className="text-sm text-danger">Perfil não encontrado.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8">
      <div className="flex items-center gap-4">
        <Avatar name={profile.tradeName} photoUrl={profile.logoUrl} size="lg" shape="square" color="bg-secondary" />
        <div>
          <h1 className="font-heading text-xl font-bold text-text">{profile.tradeName}</h1>
          <p className="text-sm text-text-secondary">{profile.legalName}</p>
          <span
            className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
              VERIFICATION_STATUS_CLASS[profile.verificationStatus] ?? VERIFICATION_STATUS_CLASS.pending
            }`}
          >
            {VERIFICATION_STATUS_LABEL[profile.verificationStatus] ?? profile.verificationStatus}
          </span>
        </div>
      </div>

      <div>
        <label className="cursor-pointer text-sm font-semibold text-primary underline underline-offset-2">
          {isUploadingLogo ? 'Enviando...' : profile.logoUrl ? 'Trocar logo' : 'Adicionar logo'}
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleLogoChange}
            disabled={isUploadingLogo}
            className="sr-only"
          />
        </label>
        {logoError && <p className="mt-1 text-xs text-danger">{logoError}</p>}
        <p className="mt-1 text-xs text-text-secondary">
          Trabalhadores veem o logo ao procurar escalas perto deles.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-surface p-5 text-center">
          <p className="font-heading text-2xl font-bold text-text">★ {profile.avgRating ?? '—'}</p>
          <p className="mt-1 text-xs text-text-secondary">Nota média recebida</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 text-center">
          <p className="font-heading text-2xl font-bold text-text">{profile.jobsPosted}</p>
          <p className="mt-1 text-xs text-text-secondary">Trabalhos publicados</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 text-center">
          <p className="font-heading text-2xl font-bold text-text">{profile.shiftsCompleted}</p>
          <p className="mt-1 text-xs text-text-secondary">Trabalhos concluídos</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 text-center">
          <p className="font-heading text-2xl font-bold text-text">
            {profile.rehireRate !== null ? `${profile.rehireRate}%` : '—'}
          </p>
          <p className="mt-1 text-xs text-text-secondary">Taxa de recontratação</p>
        </div>
      </div>

      {profile.avgCategoryScores && (
        <div>
          <h2 className="font-heading text-[17px] font-bold text-text">Pontos fortes da empresa</h2>
          <p className="mt-1 text-xs text-text-secondary">
            A média de cada categoria que os trabalhadores avaliaram em você.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {COMPANY_RATING_CATEGORIES.flatMap((category) => {
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
                    <p className="font-heading text-[15px] font-bold text-text">{entry.workerName}</p>
                    <span className="whitespace-nowrap text-sm font-bold text-primary">★ {entry.score}</span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {[categoryName, formatShiftDate(entry.shiftDate)].filter(Boolean).join(' · ')}
                  </p>
                  {entry.comment && <p className="mt-2 text-sm text-text">&ldquo;{entry.comment}&rdquo;</p>}
                  {entry.categoryScores && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {COMPANY_RATING_CATEGORIES.flatMap((category) => {
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

      <div className="flex flex-col gap-4 border-t border-border pt-6">
        <h2 className="font-heading text-lg font-bold text-text">Notificações</h2>
        <NotificationsToggle />
      </div>

      <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 border-t border-border pt-6">
        <h2 className="font-heading text-lg font-bold text-text">Dados da empresa</h2>

        <Input
          id="legalName"
          label={isIndividual ? 'Nome completo' : 'Razão social'}
          type="text"
          value={legalName}
          onChange={(event) => setLegalName(event.target.value)}
        />
        <Input
          id="tradeName"
          label={isIndividual ? 'Como quer aparecer' : 'Nome fantasia'}
          type="text"
          value={tradeName}
          onChange={(event) => setTradeName(event.target.value)}
        />
        {isIndividual ? (
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
        ) : (
          <Input
            id="cnpj"
            label="CNPJ"
            type="text"
            inputMode="numeric"
            placeholder="00.000.000/0000-00"
            maxLength={18}
            value={formatCnpj(cnpj)}
            onChange={(event) => setCnpj(extractDigits(event.target.value).slice(0, 14))}
          />
        )}
        <div>
          <label htmlFor="businessSegment" className="mb-1.5 block text-sm font-medium text-text-secondary">
            Ramo de atividade (opcional)
          </label>
          <select
            id="businessSegment"
            value={businessSegment}
            onChange={(event) => setBusinessSegment(event.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-text transition focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
          >
            <option value="">Selecione (opcional)</option>
            {BUSINESS_SEGMENTS.map((segment) => (
              <option key={segment.value} value={segment.value}>
                {segment.label}
              </option>
            ))}
          </select>
          {businessSegment === 'outro' && (
            <div className="mt-3">
              <Input
                id="businessSegmentOther"
                label="Qual é o ramo de atividade?"
                type="text"
                placeholder="Descreva o ramo da sua empresa"
                value={businessSegmentOther}
                onChange={(event) => setBusinessSegmentOther(event.target.value)}
              />
            </div>
          )}
        </div>

        {profileError && <p className="text-sm text-danger">{profileError}</p>}
        {profileSaved && <p className="text-sm text-success">Dados salvos.</p>}

        <Button type="submit" disabled={!isProfileValid} isLoading={isSavingProfile} className="self-start">
          Salvar dados da empresa
        </Button>
      </form>

      <form onSubmit={handleChangePassword} className="flex flex-col gap-4 border-t border-border pt-6">
        <h2 className="font-heading text-lg font-bold text-text">Alterar senha</h2>

        <Input
          id="currentPassword"
          label="Senha atual"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
        <Input
          id="newPassword"
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <Input
          id="confirmNewPassword"
          label="Confirme a nova senha"
          type="password"
          autoComplete="new-password"
          value={confirmNewPassword}
          onChange={(event) => setConfirmNewPassword(event.target.value)}
          error={confirmNewPassword.length > 0 && !passwordsMatch ? 'As senhas não coincidem.' : undefined}
        />

        {passwordError && <p className="text-sm text-danger">{passwordError}</p>}
        {passwordChanged && <p className="text-sm text-success">Senha alterada.</p>}

        <Button type="submit" disabled={!isPasswordFormValid} isLoading={isChangingPassword} className="self-start">
          Alterar senha
        </Button>
      </form>

      <Button variant="outlined" onClick={handleLogout} isLoading={isLoggingOut}>
        Sair da conta
      </Button>
    </main>
  );
}
