'use client';

import { ApiError, getCurrentUser, UserResponse } from '@shift/shared';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { CardListSkeleton } from '../../../components/ui/skeleton';
import { AdminUser, findUserByEmail, FoundUser, listAdmins, setUserAdmin } from '../../../lib/admin-api';

/** Fallback igual ao resto do admin (ver displayName() em admin/layout.tsx). */
function displayName(user: { fullName: string | null; email: string | null }): string {
  return user.fullName ?? user.email?.split('@')[0] ?? 'sem e-mail';
}

/**
 * Só chega aqui quem já passou por requireAdmin + requireSuperAdmin no
 * backend (rotas /admin/admins, /admin/users/find, /admin/users/:id/admin)
 * — a checagem de `isSuperAdmin` aqui é só pra não mostrar um formulário
 * que vai bater 403 em quem não tem a permissão (ver
 * modules/admin/require-super-admin.ts no backend).
 */
export default function AdminAdministradoresPage() {
  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [emailQuery, setEmailQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);

  const [confirmingGrantId, setConfirmingGrantId] = useState<string | null>(null);
  const [confirmingRevokeId, setConfirmingRevokeId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser()
      .then(({ user }) => setCurrentUser(user))
      .catch(() => setCurrentUser(null))
      .finally(() => setIsLoadingUser(false));
  }, []);

  function reloadAdmins(): void {
    setIsLoadingAdmins(true);
    listAdmins()
      .then((result) => setAdmins(result.admins))
      .catch(() => setLoadError('Não foi possível carregar a lista de administradores.'))
      .finally(() => setIsLoadingAdmins(false));
  }

  useEffect(() => {
    if (isLoadingUser || !currentUser?.isSuperAdmin) return;

    let cancelled = false;
    listAdmins()
      .then((result) => {
        if (!cancelled) setAdmins(result.admins);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Não foi possível carregar a lista de administradores.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAdmins(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoadingUser, currentUser?.isSuperAdmin]);

  async function handleSearch(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!emailQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setFoundUser(null);
    try {
      const result = await findUserByEmail(emailQuery.trim());
      setFoundUser(result.user);
    } catch (err) {
      setSearchError(err instanceof ApiError ? err.message : 'Não foi possível buscar esse e-mail.');
    } finally {
      setIsSearching(false);
    }
  }

  async function handleGrant(user: FoundUser): Promise<void> {
    if (confirmingGrantId !== user.id) {
      setConfirmingGrantId(user.id);
      return;
    }

    setPendingId(user.id);
    setActionError(null);
    try {
      const result = await setUserAdmin(user.id, true);
      setFoundUser((current) => (current && current.id === user.id ? { ...current, isAdmin: result.isAdmin } : current));
      reloadAdmins();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível conceder acesso de administrador.');
    } finally {
      setPendingId(null);
      setConfirmingGrantId(null);
    }
  }

  async function handleRevoke(admin: AdminUser): Promise<void> {
    if (confirmingRevokeId !== admin.id) {
      setConfirmingRevokeId(admin.id);
      return;
    }

    setPendingId(admin.id);
    setActionError(null);
    try {
      await setUserAdmin(admin.id, false);
      reloadAdmins();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível revogar o acesso de administrador.');
    } finally {
      setPendingId(null);
      setConfirmingRevokeId(null);
    }
  }

  if (isLoadingUser) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5">
        <CardListSkeleton />
      </main>
    );
  }

  if (!currentUser?.isSuperAdmin) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 text-center">
        <p className="text-sm text-danger">Essa área é restrita a quem pode gerenciar outros administradores.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-[0_4px_14px_rgba(26,23,18,0.05)]">
        <h2 className="font-heading text-[16px] font-bold text-text">Conceder acesso de administrador</h2>
        <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              id="search-email"
              label="E-mail do usuário"
              type="email"
              placeholder="pessoa@exemplo.com"
              value={emailQuery}
              onChange={(event) => setEmailQuery(event.target.value)}
            />
          </div>
          <Button type="submit" variant="primary" isLoading={isSearching}>
            Buscar
          </Button>
        </form>

        {searchError && <p className="text-sm text-danger">{searchError}</p>}

        {foundUser && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-background p-3">
            <div>
              <p className="font-semibold text-text">{displayName(foundUser)}</p>
              <p className="text-sm text-text-secondary">{foundUser.email}</p>
            </div>
            {foundUser.isAdmin ? (
              <span className="whitespace-nowrap rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                Já é admin
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={confirmingGrantId === foundUser.id ? 'danger' : 'outlined'}
                  isLoading={pendingId === foundUser.id}
                  onClick={() => handleGrant(foundUser)}
                >
                  {confirmingGrantId === foundUser.id ? 'Confirmar' : 'Tornar admin'}
                </Button>
                {confirmingGrantId === foundUser.id && pendingId !== foundUser.id && (
                  <button
                    type="button"
                    onClick={() => setConfirmingGrantId(null)}
                    className="text-sm text-text-secondary underline underline-offset-2"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-[16px] font-bold text-text">Administradores atuais</h2>
        {loadError && <p className="text-sm text-danger">{loadError}</p>}
        {actionError && <p className="text-sm text-danger">{actionError}</p>}

        {isLoadingAdmins ? (
          <CardListSkeleton />
        ) : (
          <ul className="flex flex-col gap-3">
            {admins.map((admin) => {
              const isSelf = admin.id === currentUser.id;
              return (
                <li
                  key={admin.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-[0_4px_14px_rgba(26,23,18,0.05)]"
                >
                  <div>
                    <p className="font-heading text-[15px] font-bold text-text">{displayName(admin)}</p>
                    <p className="text-sm text-text-secondary">{admin.email}</p>
                  </div>
                  {isSelf ? (
                    <span className="whitespace-nowrap text-xs font-semibold text-text-secondary">Você</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={confirmingRevokeId === admin.id ? 'danger' : 'outlined'}
                        isLoading={pendingId === admin.id}
                        onClick={() => handleRevoke(admin)}
                      >
                        {confirmingRevokeId === admin.id ? 'Confirmar' : 'Revogar'}
                      </Button>
                      {confirmingRevokeId === admin.id && pendingId !== admin.id && (
                        <button
                          type="button"
                          onClick={() => setConfirmingRevokeId(null)}
                          className="text-sm text-text-secondary underline underline-offset-2"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
