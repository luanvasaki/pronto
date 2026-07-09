'use client';

import { ApiError, extractDigits, formatCnpj, isValidPassword, logout } from '@shift/shared';
import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useState } from 'react';
import { Avatar } from '../../../components/ui/avatar';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  BUSINESS_SEGMENTS,
  changePassword,
  uploadCompanyLogo,
  upsertCompanyProfile,
} from '../../../lib/company-profile-api';
import { useCompanyProfile } from '../company-profile-context';

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
  const [cnpj, setCnpj] = useState(profile?.cnpj ?? '');
  const [addressLabel, setAddressLabel] = useState(profile?.addressLabel ?? '');
  const [businessSegment, setBusinessSegment] = useState(profile?.businessSegment ?? '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordChanged, setPasswordChanged] = useState(false);

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

  const isProfileValid = legalName.trim().length >= 2 && tradeName.trim().length >= 2 && cnpj.trim().length === 14;

  async function handleSaveProfile(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!isProfileValid || isSavingProfile || !profile) return;

    setProfileError(null);
    setProfileSaved(false);
    setIsSavingProfile(true);

    try {
      const updated = await upsertCompanyProfile({
        legalName,
        tradeName,
        cnpj,
        addressLabel: addressLabel.trim() || undefined,
        businessSegment: businessSegment || undefined,
      });
      setProfile({ ...profile, ...updated });
      setProfileSaved(true);
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
          Trabalhadores veem o logo ao procurar turnos perto deles.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-surface p-5 text-center">
          <p className="font-heading text-2xl font-bold text-text">★ {profile.avgRating ?? '—'}</p>
          <p className="mt-1 text-xs text-text-secondary">Nota média</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 text-center">
          <p className="font-heading text-2xl font-bold text-text">{profile.totalJobsPosted}</p>
          <p className="mt-1 text-xs text-text-secondary">Vagas publicadas</p>
        </div>
      </div>

      <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 border-t border-border pt-6">
        <h2 className="font-heading text-lg font-bold text-text">Dados da empresa</h2>

        <Input
          id="legalName"
          label="Razão social"
          type="text"
          value={legalName}
          onChange={(event) => setLegalName(event.target.value)}
        />
        <Input
          id="tradeName"
          label="Nome fantasia"
          type="text"
          value={tradeName}
          onChange={(event) => setTradeName(event.target.value)}
        />
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
        <Input
          id="addressLabel"
          label="Endereço (opcional)"
          type="text"
          placeholder="Vila Madalena, São Paulo"
          value={addressLabel}
          onChange={(event) => setAddressLabel(event.target.value)}
        />
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
