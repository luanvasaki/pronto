import { TabBar } from '../../components/ui/tab-bar';

/**
 * Grupo de rotas (parênteses não entram na URL) — só as telas
 * autenticadas do dia a dia (início, candidaturas, turnos, perfil)
 * ganham a tab bar fixa embaixo; login/cadastro ficam fora do grupo.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col">{children}</div>
      <TabBar />
    </div>
  );
}
