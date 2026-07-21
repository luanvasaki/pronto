import Link from 'next/link';

export interface VerificationBannerProps {
  verificationStatus: string;
  rejectionReason: string | null;
}

/**
 * Faixa persistente (não dispensável) enquanto a empresa não está
 * aprovada — sem isso, o único aviso de "cadastro incompleto" ficava
 * escondido em /perfil ou no botão de publicar vaga desabilitado em
 * /vagas/nova, e a empresa navegava o resto do app sem entender por que
 * não consegue publicar. Mesmo lugar (logo abaixo do Topbar) e visual
 * de faixa full-width do InstallAppBanner, mas sem botão de fechar —
 * isso aqui reflete um bloqueio de verdade, não uma sugestão.
 */
export function VerificationBanner({ verificationStatus, rejectionReason }: VerificationBannerProps) {
  if (verificationStatus === 'approved') return null;

  if (verificationStatus === 'rejected') {
    return (
      <div className="border-b border-danger/30 bg-danger/10 px-5 py-3 text-sm text-danger">
        <p className="font-semibold">Sua empresa não foi aprovada{rejectionReason ? `: ${rejectionReason}` : '.'}</p>
        <Link href="/perfil" className="mt-0.5 inline-block font-semibold underline underline-offset-2">
          Reenviar documento
        </Link>
      </div>
    );
  }

  return (
    <div className="border-b border-warning/30 bg-warning/10 px-5 py-3 text-sm text-warning">
      Sua empresa está em análise. Assim que for aprovada, você poderá publicar vagas.
    </div>
  );
}
