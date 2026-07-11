export interface JobTermsCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}

/**
 * Aceite explícito por vaga publicada — mesmo respaldo jurídico do
 * TermsCheckbox do cadastro, mas repetido a cada escala: a empresa
 * confirma, vaga por vaga, que a contratação é avulsa e sob
 * responsabilidade dela, não do Pronto.
 */
export function JobTermsCheckbox({ checked, onChange, id = 'job-terms-accepted' }: JobTermsCheckboxProps) {
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
        Confirmo que essa escala é uma contratação avulsa e temporária, direto entre minha empresa e o
        profissional — o Pronto só intermedia, sem vínculo empregatício, e as obrigações trabalhistas e
        previdenciárias dessa vaga são de minha responsabilidade.
      </span>
    </label>
  );
}
