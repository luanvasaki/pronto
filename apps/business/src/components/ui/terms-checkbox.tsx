export interface TermsCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}

/**
 * Aceite explícito da cláusula "Pronto é só intermediário, sem vínculo
 * empregatício" — existe pra dar ao Pronto uma base de defesa jurídica
 * inicial (risco real de reconhecimento de vínculo em plataforma de
 * gig work). Aparece no cadastro por e-mail/senha e antes do login com
 * Google (que pode criar conta nova silenciosamente).
 */
export function TermsCheckbox({ checked, onChange, id = 'terms-accepted' }: TermsCheckboxProps) {
  return (
    <label htmlFor={id} className="flex items-start gap-2.5 text-sm text-text-secondary">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"
      />
      <span>
        Li e concordo que o Pronto é só um intermediário: não é empregador de ninguém, não dirige nem
        fiscaliza o trabalho, e a prestação de serviço acontece diretamente entre empresa e profissional,
        sem vínculo empregatício com o Pronto.
      </span>
    </label>
  );
}
