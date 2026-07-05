/**
 * Símbolo é um anel (o "o" de pr[o]nto) — não um ponto, de propósito,
 * pra diferenciar do varejista "Ponto". Ver design_handoff_pronto/README.md.
 */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-end ${className}`} aria-label="Pronto">
      <span className="font-heading text-2xl leading-[0.8] font-extrabold tracking-[-0.03em] text-text">
        pr
      </span>
      <span
        aria-hidden="true"
        className="mx-px mb-[3px] box-border h-[13px] w-[13px] rounded-full border-[3px] border-primary"
      />
      <span className="font-heading text-2xl leading-[0.8] font-extrabold tracking-[-0.03em] text-text">
        nto
      </span>
    </div>
  );
}
