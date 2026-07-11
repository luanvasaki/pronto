'use client';

import { ApiError } from '@shift/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TabBar } from '../../components/ui/tab-bar';
import { CalledNotification, Topbar } from '../../components/ui/topbar';
import { listMyApplications } from '../../lib/applications-api';
import { useRequireAuth } from '../../hooks/use-require-auth';
import { listMyShifts } from '../../lib/shifts-api';
import { getWorkerProfile, WorkerProfileDetails } from '../../lib/worker-profile-api';
import { WorkerProfileProvider } from './worker-profile-context';

// Sem WebSocket/push — reconsultar de tempos em tempos enquanto o app
// fica aberto é o suficiente pro volume do MVP (mesmo padrão do painel
// da empresa). Exportada porque a tela de Início faz o mesmo polling
// pros avisos que mostra em banner (ver src/app/(app)/inicio/page.tsx).
export const NOTIFICATIONS_POLL_INTERVAL_MS = 60_000;

/**
 * Grupo de rotas (parênteses não entram na URL) — só as telas
 * autenticadas do dia a dia (início, candidaturas, escalas, perfil)
 * ganham a tab bar fixa embaixo; login/cadastro ficam fora do grupo.
 *
 * `useRequireAuth` aqui (uma vez, no layout) em vez de em cada página —
 * mesma checagem que o app business já fazia por página, mas o worker
 * tem um layout próprio pras rotas autenticadas, então cobre todas de uma vez.
 *
 * Também busca o perfil aqui (uma vez, compartilhado via
 * WorkerProfileProvider) e redireciona pra /cadastro quando ele ainda
 * não existe — cobre tanto registro normal (que já encadeia pra lá
 * sozinho) quanto login pelo Google (que hoje manda direto pro app sem
 * checar nada, e sem isso cada página tentava buscar o perfil sozinha
 * e só mostrava um erro genérico). Da mesma forma, se o perfil existe
 * mas o documento ou a selfie nunca foram enviados (ex.: usuário fechou
 * o app entre os dois passos do cadastro), manda de volta pro upload —
 * sem isso dava pra "concluir" o cadastro sem eles só navegando direto
 * pro app.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isChecking } = useRequireAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<WorkerProfileDetails | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [calledCount, setCalledCount] = useState(0);
  const [calledNotifications, setCalledNotifications] = useState<CalledNotification[]>([]);

  useEffect(() => {
    if (isChecking) return;

    getWorkerProfile()
      .then((data) => {
        if (!data.hasDocument || !data.hasSelfie) {
          setIsRedirecting(true);
          router.replace('/cadastro/documento');
          return;
        }
        setProfile(data);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setIsRedirecting(true);
          router.replace('/cadastro');
        }
      })
      .finally(() => setIsLoadingProfile(false));
  }, [isChecking, router]);

  useEffect(() => {
    if (isChecking || isRedirecting) return;

    let cancelled = false;

    function poll(): void {
      Promise.all([listMyApplications(), listMyShifts()])
        .then(([{ applications }, { shifts }]) => {
          if (cancelled) return;
          const called = applications.filter((a) => a.status === 'approved' && a.workerSeenAt === null);
          const removed = applications.filter((a) => a.removedAt !== null && a.workerSeenRemovalAt === null);
          const pendingRatings = shifts.filter((shift) => shift.status === 'completed' && !shift.ratings.worker);
          setCalledCount(called.length + removed.length + pendingRatings.length);
          setCalledNotifications([
            ...called.map((a) => ({
              id: a.id,
              message: `${a.companyName || 'Uma empresa'} aceitou sua candidatura!`,
              href: '/inicio',
            })),
            ...removed.map((a) => ({
              id: a.id,
              message: `${a.companyName || 'Uma empresa'} removeu você da escala.`,
              href: '/inicio',
            })),
            ...pendingRatings.map((shift) => ({
              id: shift.id,
              message: 'Você tem uma escala concluída esperando avaliação.',
              href: '/agenda',
            })),
          ]);
        })
        .catch(() => undefined);
    }

    poll();
    const intervalId = setInterval(poll, NOTIFICATIONS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [isChecking, isRedirecting]);

  if (isChecking || isLoadingProfile || isRedirecting || !profile) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">
          {isChecking ? 'Confirmando sua sessão...' : isRedirecting ? 'Redirecionando...' : 'Carregando...'}
        </p>
      </main>
    );
  }

  return (
    <WorkerProfileProvider initialProfile={profile}>
      <div className="flex flex-1 flex-col">
        <Topbar calledCount={calledCount} calledNotifications={calledNotifications} />
        <div className="flex flex-1 flex-col">{children}</div>
        <TabBar />
      </div>
    </WorkerProfileProvider>
  );
}
