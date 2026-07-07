'use client';

import { logout } from '@shift/shared';
import { useRouter } from 'next/navigation';
import { ChangeEvent, useState } from 'react';
import { Avatar } from '../../../components/ui/avatar';
import { Button } from '../../../components/ui/button';
import { uploadCompanyLogo } from '../../../lib/company-profile-api';
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

  if (!profile) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 text-center">
        <p className="text-sm text-danger">Perfil não encontrado.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
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

      <p className="font-mono text-sm text-text-secondary">CNPJ {profile.cnpj}</p>

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

      <Button variant="outlined" onClick={handleLogout} isLoading={isLoggingOut}>
        Sair da conta
      </Button>
    </main>
  );
}
