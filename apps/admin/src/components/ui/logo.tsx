/**
 * Símbolo é um anel (o "o" de pr[o]nto) — não um ponto, de propósito,
 * pra diferenciar do varejista "Ponto". Ver design_handoff_pronto/README.md.
 *
 * `variant="inverted"` troca o texto de `text-text` pra `text-background`
 * — usar em cima de `bg-secondary` (sidebar, admin nav), já que
 * `--color-secondary` e `--color-text` ficam com tons quase idênticos
 * em ambos os temas e o texto do logo "some" sem essa troca.
 */
export function Logo({
  className = '',
  variant = 'default',
}: {
  className?: string;
  variant?: 'default' | 'inverted';
}) {
  const textClassName = variant === 'inverted' ? 'text-background' : 'text-text';
  return (
    <div className={`flex items-end ${className}`} aria-label="Pronto">
      <span className={`font-heading text-2xl leading-[0.8] font-extrabold tracking-[-0.03em] ${textClassName}`}>
        pr
      </span>
      <span
        aria-hidden="true"
        className="mx-px mb-[3px] box-border h-[13px] w-[13px] rounded-full border-[3px] border-primary"
      />
      <span className={`font-heading text-2xl leading-[0.8] font-extrabold tracking-[-0.03em] ${textClassName}`}>
        nto
      </span>
    </div>
  );
}
