'use client';

import { useRouter } from 'next/navigation';

export interface SignupProgressProps {
  step: number;
  totalSteps?: number;
}

/**
 * Cadastro é 3 telas sem nenhuma pista de quanto falta nem como voltar
 * (conta → cadastro → documento) — maior risco de abandono do funil.
 * `router.back()` em vez de um href fixo: assim "voltar" sempre leva
 * pra tela anterior de verdade (mesmo na primeira etapa, onde a
 * "anterior" pode ser a landing ou a tela de login), sem precisar
 * decidir de antemão o destino de cada etapa.
 */
export function SignupProgress({ step, totalSteps = 3 }: SignupProgressProps) {
  const router = useRouter();

  return (
    <div className="mb-1 flex items-center gap-3">
      <button
        type="button"
        onClick={() => router.back()}
        aria-label="Voltar"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-text transition hover:border-primary hover:text-primary"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="flex-1">
        <p className="text-xs font-semibold text-text-secondary">
          Passo {step} de {totalSteps}
        </p>
        <div className="mt-1.5 flex gap-1.5" aria-hidden="true">
          {Array.from({ length: totalSteps }, (_, index) => (
            <span key={index} className={`h-1.5 flex-1 rounded-full ${index < step ? 'bg-primary' : 'bg-border'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
