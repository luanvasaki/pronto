import { BenefitProvision } from '@shift/shared';
import { Input } from './input';

export interface JobBenefitsFieldsProps {
  mealProvision: BenefitProvision;
  onMealProvisionChange: (value: BenefitProvision) => void;
  mealAmount: string;
  onMealAmountChange: (value: string) => void;
  transportProvision: BenefitProvision;
  onTransportProvisionChange: (value: BenefitProvision) => void;
  transportAmount: string;
  onTransportAmountChange: (value: string) => void;
}

const PROVISION_OPTIONS: { value: BenefitProvision; label: string }[] = [
  { value: 'none', label: 'Não oferece' },
  { value: 'on_site', label: 'No local' },
  { value: 'paid', label: 'Por um valor' },
];

interface BenefitToggleProps {
  legend: string;
  provision: BenefitProvision;
  onProvisionChange: (value: BenefitProvision) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  amountId: string;
  amountLabel: string;
}

function BenefitToggle({
  legend,
  provision,
  onProvisionChange,
  amount,
  onAmountChange,
  amountId,
  amountLabel,
}: BenefitToggleProps) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-text-secondary">{legend}</span>
      <div className="flex gap-2">
        {PROVISION_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={provision === option.value}
            onClick={() => onProvisionChange(option.value)}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition ${
              provision === option.value
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-surface text-text-secondary'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {provision === 'paid' && (
        <div className="mt-2.5">
          <Input
            id={amountId}
            label={amountLabel}
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(event) => onAmountChange(event.target.value)}
          />
        </div>
      )}
    </div>
  );
}

/** Bloco "Benefícios oferecidos" — idêntico entre nova vaga e editar vaga. */
export function JobBenefitsFields({
  mealProvision,
  onMealProvisionChange,
  mealAmount,
  onMealAmountChange,
  transportProvision,
  onTransportProvisionChange,
  transportAmount,
  onTransportAmountChange,
}: JobBenefitsFieldsProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
      <p className="font-heading text-sm font-bold text-text">Benefícios oferecidos</p>

      <BenefitToggle
        legend="Alimentação"
        provision={mealProvision}
        onProvisionChange={onMealProvisionChange}
        amount={mealAmount}
        onAmountChange={onMealAmountChange}
        amountId="mealAmount"
        amountLabel="Valor da alimentação (R$)"
      />

      <BenefitToggle
        legend="Transporte"
        provision={transportProvision}
        onProvisionChange={onTransportProvisionChange}
        amount={transportAmount}
        onAmountChange={onTransportAmountChange}
        amountId="transportAmount"
        amountLabel="Valor do transporte (R$)"
      />
    </div>
  );
}
