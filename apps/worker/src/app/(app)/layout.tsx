'use client';

import { TabBar } from '../../components/ui/tab-bar';
import { useRequireAuth } from '../../hooks/use-require-auth';

/**
 * Grupo de rotas (parênteses não entram na URL) — só as telas
 * autenticadas do dia a dia (início, candidaturas, turnos, perfil)
 * ganham a tab bar fixa embaixo; login/cadastro ficam fora do grupo.
 *
 * `useRequireAuth` aqui (uma vez, no layout) em vez de em cada página —
 * mesma checagem que o app business já fazia por página, mas o worker
 * tem um layout próprio pras rotas autenticadas, então cobre todas de uma vez.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isChecking } = useRequireAuth();

  if (isChecking) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Confirmando sua sessão...</p>
      </main>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col">{children}</div>
      <TabBar />
    </div>
  );
}
