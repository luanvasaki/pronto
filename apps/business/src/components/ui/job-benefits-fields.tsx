export interface JobBenefitsFieldsProps {
  offersMeal: boolean;
  onOffersMealChange: (value: boolean) => void;
  offersTransport: boolean;
  onOffersTransportChange: (value: boolean) => void;
}

/** Bloco "Benefícios oferecidos" — idêntico entre nova vaga e editar vaga. */
export function JobBenefitsFields({
  offersMeal,
  onOffersMealChange,
  offersTransport,
  onOffersTransportChange,
}: JobBenefitsFieldsProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <p className="font-heading text-sm font-bold text-text">Benefícios oferecidos</p>
      <label className="flex items-center gap-2 text-sm font-medium text-text">
        <input type="checkbox" checked={offersMeal} onChange={(event) => onOffersMealChange(event.target.checked)} />
        Oferece alimentação
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-text">
        <input
          type="checkbox"
          checked={offersTransport}
          onChange={(event) => onOffersTransportChange(event.target.checked)}
        />
        Oferece transporte
      </label>
    </div>
  );
}
