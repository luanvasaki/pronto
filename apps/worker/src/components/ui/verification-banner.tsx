import Link from 'next/link';

export interface VerificationBannerProps {
  kycStatus: string;
}

/**
 * Faixa persistente (não dispensável) enquanto o cadastro não está
 * aprovado — cobre o caso que faltava: `kycStatus === 'pending'` com
 * identidade+selfie já enviados, só esperando revisão do admin, onde o
 * trabalhador navegava o app livremente sem entender por que não
 * consegue se candidatar (o layout só força redirect pra
 * /cadastro/documento quando falta ou foi reprovado algum documento,
 * ver apps/worker/.../(app)/layout.tsx).
 */
export function VerificationBanner({ kycStatus }: VerificationBannerProps) {
  if (kycStatus === 'approved') return null;

  if (kycStatus === 'rejected') {
    return (
      <div className="border-b border-danger/30 bg-danger/10 px-5 py-3 text-sm text-danger">
        <p className="font-semibold">Um dos seus documentos foi reprovado.</p>
        <Link href="/cadastro/documento" className="mt-0.5 inline-block font-semibold underline underline-offset-2">
          Ver motivo e reenviar
        </Link>
      </div>
    );
  }

  return (
    <div className="border-b border-warning/30 bg-warning/10 px-5 py-3 text-sm text-warning">
      Seu cadastro está em análise. Assim que for aprovado, você poderá se candidatar a vagas.
    </div>
  );
}
